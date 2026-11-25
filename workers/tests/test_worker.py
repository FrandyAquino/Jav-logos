import base64
import io
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import time
import unittest
from unittest.mock import patch

from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from worker import WorkerError, decode_image, run_command, validate_generation


class WorkerTests(unittest.TestCase):
    def request(self, **changes):
        return dict(jobId="test-job", prompt="A geometric logo", seed=42,
                    count=1, width=256, height=256, **changes)

    def test_rejects_invalid_dimensions_and_booleans(self):
        for field, value in [("count", 0), ("width", 257), ("height", 2048), ("seed", True)]:
            request = self.request()
            request[field] = value
            with self.subTest(field=field), self.assertRaises(WorkerError):
                validate_generation(request)

    def test_rejects_empty_prompt(self):
        request = self.request()
        request["prompt"] = "  "
        with self.assertRaises(WorkerError):
            validate_generation(request)

    def test_rejects_invalid_reference(self):
        with self.assertRaises(WorkerError):
            decode_image("<svg onload='alert(1)'></svg>")

    def test_unavailable_provider_health_is_explicit(self):
        with patch.dict(os.environ, {"JAVLOGOS_PROVIDER": "sdcpp", "JAVLOGOS_SD_CLI": "/no/such/binary"}):
            result = run_command("health", {})
        self.assertFalse(result["available"])
        self.assertIn("JAVLOGOS_SD_CLI", result["message"])

    def test_vectorization_returns_actual_paths(self):
        image = Image.new("RGB", (32, 32), "white")
        for x in range(8, 24):
            for y in range(8, 24):
                image.putpixel((x, y), (10, 50, 100))
        output = io.BytesIO()
        image.save(output, format="PNG")
        result = run_command("vectorize", {"pngBase64": base64.b64encode(output.getvalue()).decode()})
        self.assertIn("<svg", result)
        self.assertIn("<path", result)
        self.assertNotIn("<script", result)

    def test_cli_rejects_payload_with_structured_error(self):
        process = subprocess.run([sys.executable, str(Path(__file__).resolve().parents[1] / "worker.py"), "generate"],
                                 input='{"prompt": ""}', capture_output=True, text=True)
        self.assertEqual(process.returncode, 1)
        self.assertEqual(json.loads(process.stdout)["error"]["code"], "INVALID_INPUT")

    def test_comfyui_rejects_remote_urls(self):
        from comfyui_adapter import ComfyUiProvider
        for endpoint in ["https://example.com", "http://192.168.1.1:8188", "http://user@localhost:8188"]:
            with self.subTest(endpoint=endpoint), self.assertRaises(WorkerError):
                ComfyUiProvider({"comfy_url": endpoint})

    def test_preview_event_contains_bounded_real_png(self):
        from contextlib import redirect_stderr
        from progress import image_ready
        source=Image.new("RGB",(1024,512),(20,60,100))
        output=io.StringIO()
        with redirect_stderr(output):image_ready(source,2,3)
        event=json.loads(output.getvalue().removeprefix("JAVLOGOS_EVENT "))
        self.assertEqual((event["phase"],event["imageIndex"],event["imageCount"]),("image-ready",2,3))
        self.assertLessEqual(len(event["previewBase64"]),256*1024)
        image=decode_image(event["previewBase64"])
        self.assertEqual(image.size,(256,128))
        self.assertEqual(image.getpixel((50,50)),(20,60,100))

    def test_sdcpp_runs_one_process_for_a_complete_ordered_batch(self):
        from contextlib import redirect_stderr
        from sdcpp import SdCppProvider
        with tempfile.TemporaryDirectory() as temporary:
            root=Path(temporary);binary=root/"sd-cli";model=root/"model"
            binary.write_text("#!/usr/bin/env python3\n");binary.chmod(0o700);model.touch()
            provider=SdCppProvider({"sd_cli":str(binary),"flux_model":str(model),"text_encoder":str(model),"vae":str(model)})
            launches=[]
            class Inference:
                def __init__(self,args,**kwargs):
                    launches.append(args)
                    template=args[args.index("--output")+1]
                    for index in range(int(args[args.index("--batch-count")+1])):
                        Image.new("RGB",(256,256),(index*80,50,100)).save(template % index)
                def wait(self,timeout):return 0
                def poll(self):return 0
            request=self.request();request["count"]=3
            with patch("sdcpp.subprocess.Popen",Inference),redirect_stderr(io.StringIO()):
                result=provider.generate(request)
            self.assertEqual(len(launches),1)
            self.assertEqual([image["seed"] for image in result["images"]],[42,43,44])
            self.assertEqual([decode_image(image["pngBase64"]).getpixel((0,0))[0] for image in result["images"]],[0,80,160])

    def test_comfyui_cleanup_attempts_targeted_interrupt_even_if_queue_delete_fails(self):
        from comfyui_adapter import ComfyUiProvider
        with tempfile.TemporaryDirectory() as temporary:
            workflow=Path(temporary)/"workflow.json"
            workflow.write_text(json.dumps({"inputs":["{{prompt}}","{{seed}}","{{width}}","{{height}}"]}))
            provider=ComfyUiProvider({"comfy_workflow":str(workflow),"comfy_targeted_interrupt":"true"})
            calls=[]
            def request(path,payload=None,**kwargs):
                calls.append((path,payload,kwargs))
                if path=="/prompt":return {"prompt_id":"owned-prompt"}
                if path.startswith("/history/"):raise WorkerError("Stopped")
                if path=="/queue":raise WorkerError("Queue timeout")
                return {}
            with patch.object(provider,"request",side_effect=request),self.assertRaises(WorkerError):
                provider.generate(self.request())
            self.assertEqual(calls[-1],("/interrupt",{"prompt_id":"owned-prompt"},{"timeout":2}))
            self.assertEqual(calls[-2][2],{"timeout":2})

    @unittest.skipIf(os.name == "nt", "POSIX process termination evidence")
    def test_termination_reaps_owned_inference_child(self):
        with tempfile.TemporaryDirectory() as temporary:
            directory = Path(temporary)
            binary = directory / "fake-inference"
            marker = directory / "child.pid"
            binary.write_text("#!/usr/bin/env python3\nimport os,time\nfrom pathlib import Path\nPath(os.environ['JAVLOGOS_TEST_CHILD_PID']).write_text(str(os.getpid()))\ntime.sleep(30)\n")
            binary.chmod(0o700)
            model = directory / "model"
            model.touch()
            environment = dict(os.environ, JAVLOGOS_PROVIDER="sdcpp", JAVLOGOS_SD_CLI=str(binary),
                               JAVLOGOS_FLUX_MODEL=str(model), JAVLOGOS_TEXT_ENCODER=str(model),
                               JAVLOGOS_VAE=str(model), JAVLOGOS_TEST_CHILD_PID=str(marker))
            worker = subprocess.Popen([sys.executable, str(Path(__file__).resolve().parents[1] / "worker.py"), "generate"],
                                      stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, env=environment)
            try:
                worker.stdin.write(json.dumps(self.request()).encode())
                worker.stdin.close()
                deadline = time.monotonic() + 5
                while not marker.exists() and time.monotonic() < deadline:
                    time.sleep(0.05)
                self.assertTrue(marker.exists(), "Inference child did not start")
                child_pid = int(marker.read_text())
                worker.terminate()
                worker.wait(timeout=5)
                with self.assertRaises(ProcessLookupError):
                    os.kill(child_pid, 0)
            finally:
                if worker.poll() is None:
                    worker.kill()
                    worker.wait()
                worker.stdout.close()
                worker.stderr.close()


if __name__ == "__main__":
    unittest.main()
