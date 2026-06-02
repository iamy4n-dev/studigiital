# Photo Capture → OCR → Transform (Web/PWA) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add photo capture to the web/PWA — user picks or snaps an image, it uploads to S3, the backend OCRs it via Claude vision, the user confirms tags in a pre-transform step, then the existing infer → generate pipeline produces a flashcard/note/quiz artifact.

**Architecture:** Two backend calls — `POST /api/v1/captures/ocr` (downloads image from S3, extracts text via Claude vision, suggests tags) and then the existing `POST /api/v1/captures/transform` (with `confirmed_tags` so the suggest-tags LLM call is skipped). The LLMBackend gains an abstract `call_vision` method implemented by both `AnthropicBackend` and `OpenAICompatBackend`. A new `OcrExtractSkill` calls it. The web capture page gains a "Photo" mode toggle with phases: upload → scanning → tag_confirm → submitting → result. Mobile implementation is **out of scope** — file a separate backlog issue.

**Tech Stack:** FastAPI + boto3 (backend), Anthropic SDK multimodal (OCR via Claude), Next.js 15 + React 19 (web), `<input type="file" accept="image/*" capture="environment">` (PWA camera/file access), pytest-asyncio + httpx (backend tests).

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `apps/backend/src/app/core/llm.py` | Modify | Add abstract `call_vision` + implementations |
| `apps/backend/tests/test_llm_vision.py` | Create | Unit tests for `call_vision` |
| `apps/backend/src/app/skills/ocr_extract.py` | Create | `OcrExtractSkill` — image bytes → extracted text |
| `apps/backend/tests/test_ocr_extract.py` | Create | Unit tests for `OcrExtractSkill` |
| `apps/backend/src/app/core/s3.py` | Modify | Add `download_s3_object` |
| `apps/backend/tests/test_s3.py` | Modify | Add test for `download_s3_object` |
| `apps/backend/src/app/api/v1/captures.py` | Modify | Add `OcrRequest`, `OcrResponse`, `POST /ocr` route |
| `apps/backend/tests/test_captures_ocr.py` | Create | Endpoint tests for `POST /captures/ocr` |
| `packages/api-client/openapi.json` | Regenerate | Updated OpenAPI spec |
| `packages/api-client/src/types.gen.ts` | Regenerate | New `OcrRequest`/`OcrResponse` types |
| `apps/web/src/lib/photoUpload.ts` | Create | Web helper: presign → S3 PUT → OCR |
| `apps/web/src/app/capture/page.tsx` | Modify | Add Photo mode toggle + upload/scan/tag_confirm phases |

---

## Task 1: Add `call_vision` to LLMBackend

**Files:**
- Modify: `apps/backend/src/app/core/llm.py`
- Create: `apps/backend/tests/test_llm_vision.py`

### Context

`LLMBackend` is an abstract class in `apps/backend/src/app/core/llm.py`. It has one abstract method `call_structured(prompt, schema, model) -> dict`. You will add a second abstract method `call_vision(image_bytes, content_type, prompt, model) -> str` and implement it in both `AnthropicBackend` and `OpenAICompatBackend`.

The Anthropic SDK is typed (it ships `py.typed`), so mypy will check API shapes. The `messages.create` response content is `list[ContentBlock]` where `ContentBlock = TextBlock | ToolUseBlock`. Use `isinstance(block, TextBlock)` to narrow the type. The `media_type` field in the Anthropic image source must be cast because our parameter is `str` but the SDK expects a `Literal`.

The OpenAI SDK is also typed. Follow the existing `# type: ignore[index, union-attr]` pattern already used in `call_structured`.

- [ ] **Step 1: Write failing tests**

Create `apps/backend/tests/test_llm_vision.py`:

```python
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.core.llm import AnthropicBackend, OpenAICompatBackend


@pytest.mark.asyncio
async def test_anthropic_call_vision_returns_extracted_text() -> None:
    backend = AnthropicBackend.__new__(AnthropicBackend)
    mock_client = MagicMock()
    backend._client = mock_client

    mock_text_block = MagicMock()
    mock_text_block.type = "text"
    mock_text_block.text = "Hello from the image"
    mock_response = MagicMock()
    mock_response.content = [mock_text_block]
    mock_client.messages.create = AsyncMock(return_value=mock_response)

    result = await backend.call_vision(b"\xff\xd8\xff", "image/jpeg", "Extract text", "claude-haiku")

    assert result == "Hello from the image"
    mock_client.messages.create.assert_called_once()
    call_kwargs = mock_client.messages.create.call_args.kwargs
    messages = call_kwargs["messages"]
    content = messages[0]["content"]
    assert content[0]["type"] == "image"
    assert content[0]["source"]["type"] == "base64"
    assert content[0]["source"]["media_type"] == "image/jpeg"
    assert content[1]["type"] == "text"
    assert content[1]["text"] == "Extract text"


@pytest.mark.asyncio
async def test_anthropic_call_vision_raises_on_non_text_block() -> None:
    backend = AnthropicBackend.__new__(AnthropicBackend)
    mock_client = MagicMock()
    backend._client = mock_client

    mock_tool_block = MagicMock()
    mock_tool_block.type = "tool_use"
    mock_response = MagicMock()
    mock_response.content = [mock_tool_block]
    mock_client.messages.create = AsyncMock(return_value=mock_response)

    with pytest.raises(ValueError, match="Unexpected response block"):
        await backend.call_vision(b"\xff\xd8\xff", "image/jpeg", "Extract text", "claude-haiku")


@pytest.mark.asyncio
async def test_openai_compat_call_vision_returns_content() -> None:
    backend = OpenAICompatBackend.__new__(OpenAICompatBackend)
    mock_client = MagicMock()
    backend._client = mock_client

    mock_message = MagicMock()
    mock_message.content = "Vision output text"
    mock_choice = MagicMock()
    mock_choice.message = mock_message
    mock_response = MagicMock()
    mock_response.choices = [mock_choice]
    mock_client.chat.completions.create = AsyncMock(return_value=mock_response)

    result = await backend.call_vision(b"\x89PNG", "image/png", "What is in this image?", "llava")

    assert result == "Vision output text"
    call_kwargs = mock_client.chat.completions.create.call_args.kwargs
    messages = call_kwargs["messages"]
    content = messages[0]["content"]
    assert content[0]["type"] == "image_url"
    assert content[0]["image_url"]["url"].startswith("data:image/png;base64,")
    assert content[1]["type"] == "text"
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd apps/backend
uv run pytest tests/test_llm_vision.py -v
```

Expected: `AttributeError: type object 'AnthropicBackend' has no attribute 'call_vision'` (or similar import error).

- [ ] **Step 3: Implement `call_vision` on all three classes**

Edit `apps/backend/src/app/core/llm.py`. The full file after changes:

```python
from __future__ import annotations

import base64
import json
from abc import ABC, abstractmethod
from typing import Any, Literal, cast

import anthropic
from anthropic.types import TextBlock
import openai

from app.core.config import settings


class LLMBackend(ABC):
    @abstractmethod
    async def call_structured(
        self,
        prompt: str,
        schema: dict[str, Any],
        model: str,
    ) -> dict[str, Any]: ...

    @abstractmethod
    async def call_vision(
        self,
        image_bytes: bytes,
        content_type: str,
        prompt: str,
        model: str,
    ) -> str: ...


class AnthropicBackend(LLMBackend):
    def __init__(self) -> None:
        self._client = anthropic.AsyncAnthropic()

    async def call_structured(
        self,
        prompt: str,
        schema: dict[str, Any],
        model: str,
    ) -> dict[str, Any]:
        response = await self._client.messages.create(
            model=model,
            max_tokens=1024,
            tools=[
                {
                    "name": "output",
                    "description": "Return the structured output.",
                    "input_schema": schema,
                }
            ],
            tool_choice={"type": "tool", "name": "output"},
            messages=[{"role": "user", "content": prompt}],
        )
        tool_block = next(b for b in response.content if b.type == "tool_use")
        return dict(tool_block.input)

    async def call_vision(
        self,
        image_bytes: bytes,
        content_type: str,
        prompt: str,
        model: str,
    ) -> str:
        b64 = base64.standard_b64encode(image_bytes).decode()
        response = await self._client.messages.create(
            model=model,
            max_tokens=2048,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image",
                            "source": {
                                "type": "base64",
                                "media_type": cast(
                                    Literal["image/gif", "image/jpeg", "image/png", "image/webp"],
                                    content_type,
                                ),
                                "data": b64,
                            },
                        },
                        {"type": "text", "text": prompt},
                    ],
                }
            ],
        )
        block = response.content[0]
        if not isinstance(block, TextBlock):
            raise ValueError(f"Unexpected response block type: {block.type}")
        return block.text


class OpenAICompatBackend(LLMBackend):
    """Works with Ollama (http://localhost:11434/v1) and LM Studio (http://localhost:1234/v1)."""

    def __init__(self) -> None:
        self._client = openai.AsyncOpenAI(
            base_url=settings.llm_base_url,
            api_key="local",  # local servers don't verify the key; SDK requires a non-empty value
        )

    async def call_structured(
        self,
        prompt: str,
        schema: dict[str, Any],
        model: str,
    ) -> dict[str, Any]:
        response = await self._client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": prompt}],
            tools=[
                {
                    "type": "function",
                    "function": {
                        "name": "output",
                        "description": "Return the structured output.",
                        "parameters": schema,
                    },
                }
            ],
            tool_choice="required",  # Ollama/LM Studio only support string values
        )
        args = response.choices[0].message.tool_calls[0].function.arguments  # type: ignore[index, union-attr]
        return json.loads(args)  # type: ignore[no-any-return]

    async def call_vision(
        self,
        image_bytes: bytes,
        content_type: str,
        prompt: str,
        model: str,
    ) -> str:
        b64 = base64.standard_b64encode(image_bytes).decode()
        data_url = f"data:{content_type};base64,{b64}"
        response = await self._client.chat.completions.create(
            model=model,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "image_url", "image_url": {"url": data_url}},
                        {"type": "text", "text": prompt},
                    ],
                }
            ],
        )
        content = response.choices[0].message.content  # type: ignore[index, union-attr]
        return content or ""


def get_llm_backend() -> LLMBackend:
    if settings.llm_provider == "openai_compat":
        return OpenAICompatBackend()
    return AnthropicBackend()
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd apps/backend
uv run pytest tests/test_llm_vision.py -v
```

Expected: all 3 tests PASS.

- [ ] **Step 5: Verify mypy is clean**

```bash
cd apps/backend
uv run mypy src/app/core/llm.py
```

Expected: `Success: no issues found in 1 source file`

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/app/core/llm.py apps/backend/tests/test_llm_vision.py
git commit -m "feat(backend): add call_vision to LLMBackend for multimodal OCR"
```

---

## Task 2: OcrExtractSkill

**Files:**
- Create: `apps/backend/src/app/skills/ocr_extract.py`
- Create: `apps/backend/tests/test_ocr_extract.py`

### Context

`OcrExtractSkill` is not a `BaseSkill` subclass — it takes raw image bytes instead of a Pydantic model and returns plain `str` instead of structured JSON. It calls `backend.call_vision(...)` with a fixed extraction prompt. The model used is `settings.llm_model_infer` (cheap/fast, same as suggest-tags).

- [ ] **Step 1: Write failing tests**

Create `apps/backend/tests/test_ocr_extract.py`:

```python
from unittest.mock import ANY, AsyncMock, MagicMock

import pytest

from app.core.llm import LLMBackend
from app.skills.ocr_extract import OcrExtractSkill


@pytest.mark.asyncio
async def test_ocr_extract_returns_text_from_backend() -> None:
    mock_backend = MagicMock(spec=LLMBackend)
    mock_backend.call_vision = AsyncMock(return_value="Photosynthesis converts sunlight to energy.")
    skill = OcrExtractSkill(mock_backend, "claude-haiku")

    result = await skill.run(b"\xff\xd8\xff", "image/jpeg")

    assert result == "Photosynthesis converts sunlight to energy."


@pytest.mark.asyncio
async def test_ocr_extract_passes_image_bytes_and_model() -> None:
    mock_backend = MagicMock(spec=LLMBackend)
    mock_backend.call_vision = AsyncMock(return_value="some text")
    skill = OcrExtractSkill(mock_backend, "claude-haiku-test")

    await skill.run(b"\x89PNG\r\n\x1a\n", "image/png")

    mock_backend.call_vision.assert_called_once_with(
        b"\x89PNG\r\n\x1a\n",
        "image/png",
        ANY,
        "claude-haiku-test",
    )
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd apps/backend
uv run pytest tests/test_ocr_extract.py -v
```

Expected: `ModuleNotFoundError: No module named 'app.skills.ocr_extract'`

- [ ] **Step 3: Implement OcrExtractSkill**

Create `apps/backend/src/app/skills/ocr_extract.py`:

```python
from __future__ import annotations

from app.core.llm import LLMBackend

_PROMPT = (
    "Extract all text visible in this image. "
    "Return only the raw text content, preserving line breaks and structure where present. "
    "Do not add commentary or formatting."
)


class OcrExtractSkill:
    def __init__(self, backend: LLMBackend, model: str) -> None:
        self._backend = backend
        self.model = model

    async def run(self, image_bytes: bytes, content_type: str) -> str:
        return await self._backend.call_vision(image_bytes, content_type, _PROMPT, self.model)
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd apps/backend
uv run pytest tests/test_ocr_extract.py -v
```

Expected: 2 tests PASS.

- [ ] **Step 5: Verify mypy is clean**

```bash
cd apps/backend
uv run mypy src/app/skills/ocr_extract.py
```

Expected: `Success: no issues found in 1 source file`

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/app/skills/ocr_extract.py apps/backend/tests/test_ocr_extract.py
git commit -m "feat(backend): add OcrExtractSkill — image bytes to extracted text via Claude vision"
```

---

## Task 3: S3 download + `/captures/ocr` endpoint

**Files:**
- Modify: `apps/backend/src/app/core/s3.py`
- Modify: `apps/backend/tests/test_s3.py`
- Modify: `apps/backend/src/app/api/v1/captures.py`
- Create: `apps/backend/tests/test_captures_ocr.py`

### Context

`download_s3_object` is the inverse of the existing `generate_presigned_put_url` — it uses boto3 `get_object` to download bytes from S3. Follow the same `# type: ignore[import-untyped]` pattern already used for boto3 imports at the top of `s3.py`.

The `POST /captures/ocr` endpoint:
1. Downloads the image from S3 using `download_s3_object`
2. Runs `OcrExtractSkill` to extract text
3. Runs `SuggestTagsSkill` on the extracted text
4. Returns `{ extracted_text, suggested_tags }`

This endpoint is the first half of the photo capture flow. The second half (transform) reuses the existing `POST /captures/transform` endpoint unchanged.

The test mocks `download_s3_object` with `patch("app.api.v1.captures.download_s3_object", ...)` and mocks the LLM backend with both `call_vision` and `call_structured`.

- [ ] **Step 1: Write failing tests for `download_s3_object`**

Add to `apps/backend/tests/test_s3.py`:

```python
from app.core.s3 import download_s3_object


def test_download_s3_object_returns_bytes() -> None:
    with patch("app.core.s3.boto3") as mock_boto3:
        mock_client = MagicMock()
        mock_boto3.client.return_value = mock_client
        mock_body = MagicMock()
        mock_body.read.return_value = b"\xff\xd8\xff"
        mock_client.get_object.return_value = {"Body": mock_body}

        result = download_s3_object("captures/user1/abc/photo.jpg")

    assert result == b"\xff\xd8\xff"
    mock_client.get_object.assert_called_once_with(
        Bucket=settings.s3_bucket,
        Key="captures/user1/abc/photo.jpg",
    )
```

- [ ] **Step 2: Run the new test to verify it fails**

```bash
cd apps/backend
uv run pytest tests/test_s3.py::test_download_s3_object_returns_bytes -v
```

Expected: `ImportError: cannot import name 'download_s3_object'`

- [ ] **Step 3: Implement `download_s3_object` in `s3.py`**

Add to `apps/backend/src/app/core/s3.py` (after the existing `generate_presigned_put_url` function):

```python
def download_s3_object(object_key: str) -> bytes:
    client = boto3.client(
        "s3",
        region_name=settings.aws_region,
        config=Config(signature_version="s3v4"),
    )
    response = client.get_object(Bucket=settings.s3_bucket, Key=object_key)
    body: bytes = response["Body"].read()
    return body
```

- [ ] **Step 4: Run all S3 tests to verify they pass**

```bash
cd apps/backend
uv run pytest tests/test_s3.py -v
```

Expected: all 3 tests PASS.

- [ ] **Step 5: Write failing tests for the OCR endpoint**

Create `apps/backend/tests/test_captures_ocr.py`:

```python
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

from app.core.auth import UserClaims, get_current_user
from app.core.llm import LLMBackend, get_llm_backend
from app.main import app

_FAKE_IMAGE = b"\xff\xd8\xff"
_FAKE_TEXT = "Photosynthesis converts sunlight into chemical energy."
_FAKE_TAGS = {"suggestions": ["biology", "photosynthesis"]}


def _make_ocr_backend() -> LLMBackend:
    backend = MagicMock(spec=LLMBackend)
    backend.call_vision = AsyncMock(return_value=_FAKE_TEXT)
    backend.call_structured = AsyncMock(return_value=_FAKE_TAGS)
    return backend


@pytest.mark.asyncio
async def test_ocr_endpoint_returns_text_and_tags() -> None:
    mock_backend = _make_ocr_backend()
    app.dependency_overrides[get_current_user] = lambda: UserClaims(user_id="u1", tier="free")
    app.dependency_overrides[get_llm_backend] = lambda: mock_backend

    with patch("app.api.v1.captures.download_s3_object", return_value=_FAKE_IMAGE):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.post(
                "/api/v1/captures/ocr",
                json={"media_key": "captures/u1/abc/photo.jpg", "content_type": "image/jpeg"},
            )

    app.dependency_overrides.clear()
    assert response.status_code == 200
    body = response.json()
    assert body["extracted_text"] == _FAKE_TEXT
    assert body["suggested_tags"] == ["biology", "photosynthesis"]


@pytest.mark.asyncio
async def test_ocr_endpoint_calls_vision_then_suggest_tags() -> None:
    mock_backend = _make_ocr_backend()
    app.dependency_overrides[get_current_user] = lambda: UserClaims(user_id="u1", tier="free")
    app.dependency_overrides[get_llm_backend] = lambda: mock_backend

    with patch("app.api.v1.captures.download_s3_object", return_value=_FAKE_IMAGE):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            await client.post(
                "/api/v1/captures/ocr",
                json={"media_key": "captures/u1/abc/photo.jpg"},
            )

    app.dependency_overrides.clear()
    mock_backend.call_vision.assert_called_once()  # type: ignore[attr-defined]
    mock_backend.call_structured.assert_called_once()  # type: ignore[attr-defined]


@pytest.mark.asyncio
async def test_ocr_endpoint_requires_auth() -> None:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(
            "/api/v1/captures/ocr",
            json={"media_key": "captures/u1/abc/photo.jpg"},
        )
    assert response.status_code == 401
```

- [ ] **Step 6: Run the OCR endpoint tests to verify they fail**

```bash
cd apps/backend
uv run pytest tests/test_captures_ocr.py -v
```

Expected: tests fail (404 — route doesn't exist yet).

- [ ] **Step 7: Add `OcrRequest`, `OcrResponse`, and `POST /ocr` to `captures.py`**

Add these imports near the top of `apps/backend/src/app/api/v1/captures.py`:

```python
from app.core.s3 import download_s3_object, generate_presigned_put_url
from app.skills.ocr_extract import OcrExtractSkill
```

(Replace the existing `from app.core.s3 import generate_presigned_put_url` line.)

Add these models after the existing `UploadUrlResponse` model:

```python
class OcrRequest(BaseModel):
    media_key: str
    content_type: str = "image/jpeg"


class OcrResponse(BaseModel):
    extracted_text: str
    suggested_tags: list[str]
```

Add this route after the existing `POST /upload-url` route, before `POST /suggest-tags`:

```python
@router.post("/ocr", response_model=OcrResponse)
async def ocr_capture(
    payload: OcrRequest,
    _user: CurrentUser,
    backend: LLMBackendDep,
) -> OcrResponse:
    image_bytes = download_s3_object(payload.media_key)
    ocr_skill = OcrExtractSkill(backend, settings.llm_model_infer)
    extracted_text = await ocr_skill.run(image_bytes, payload.content_type)
    tags_skill = SuggestTagsSkill(backend, settings.llm_model_infer)
    tags_out = await tags_skill.run(SuggestTagsInput(text=extracted_text))
    return OcrResponse(extracted_text=extracted_text, suggested_tags=tags_out.suggestions)
```

- [ ] **Step 8: Run all captures tests to verify they pass**

```bash
cd apps/backend
uv run pytest tests/test_captures_ocr.py tests/test_captures_transform.py tests/test_captures_upload_url.py -v
```

Expected: all tests PASS.

- [ ] **Step 9: Run mypy**

```bash
cd apps/backend
uv run mypy src/
```

Expected: `Success: no issues found in N source files`

- [ ] **Step 10: Regenerate the API client**

```bash
cd apps/backend
uv run python -c "from app.main import app; import json; print(json.dumps(app.openapi(), indent=2))" \
  > ../../packages/api-client/openapi.json

cd ../../packages/api-client
pnpm generate
```

Verify that `src/types.gen.ts` now contains `OcrRequest` and `OcrResponse` types.

- [ ] **Step 11: Commit**

```bash
git add \
  apps/backend/src/app/core/s3.py \
  apps/backend/tests/test_s3.py \
  apps/backend/src/app/api/v1/captures.py \
  apps/backend/tests/test_captures_ocr.py \
  packages/api-client/openapi.json \
  packages/api-client/src/
git commit -m "feat(backend): add POST /captures/ocr — S3 download + Claude vision OCR + suggest-tags"
```

---

## Task 4: Web photo upload helper

**Files:**
- Create: `apps/web/src/lib/photoUpload.ts`

### Context

This module orchestrates the three-step web photo upload flow: presign → S3 PUT → OCR. It is called by the capture page before showing the tag confirm screen. It throws on any HTTP error so the caller can set `phase = { status: "error" }`.

The `OcrResult` type mirrors `OcrResponse` from the backend. No tests for this module — it is pure integration with external HTTP endpoints (the browser `fetch` API), and mocking all three fetches adds no signal.

- [ ] **Step 1: Create `apps/web/src/lib/photoUpload.ts`**

```typescript
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export interface OcrResult {
  extracted_text: string;
  suggested_tags: string[];
}

export async function uploadAndOcr(
  file: File,
  token: string | null,
): Promise<OcrResult> {
  const authHeader: Record<string, string> = token
    ? { Authorization: `Bearer ${token}` }
    : {};

  const presignRes = await fetch(`${API_URL}/api/v1/captures/upload-url`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeader },
    body: JSON.stringify({ filename: file.name, content_type: file.type }),
  });
  if (!presignRes.ok) throw new Error(`Presign failed: HTTP ${presignRes.status}`);
  const { upload_url, object_key } = (await presignRes.json()) as {
    upload_url: string;
    object_key: string;
  };

  const s3Res = await fetch(upload_url, {
    method: "PUT",
    headers: { "Content-Type": file.type },
    body: file,
  });
  if (!s3Res.ok) throw new Error(`S3 upload failed: HTTP ${s3Res.status}`);

  const ocrRes = await fetch(`${API_URL}/api/v1/captures/ocr`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeader },
    body: JSON.stringify({ media_key: object_key, content_type: file.type }),
  });
  if (!ocrRes.ok) throw new Error(`OCR failed: HTTP ${ocrRes.status}`);

  return (await ocrRes.json()) as OcrResult;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd apps/web
pnpm typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/photoUpload.ts
git commit -m "feat(web): add photoUpload helper — presign, S3 PUT, OCR in one call"
```

---

## Task 5: Web photo capture UI

**Files:**
- Modify: `apps/web/src/app/capture/page.tsx`

### Context

The existing capture page (`apps/web/src/app/capture/page.tsx`) has a `Phase` union type and a `CaptureShell` component. You will:

1. Add a `CaptureMode` type (`"text" | "photo"`).
2. Extend `Phase` with three new states: `uploading`, `scanning`, and `tag_confirm`.
3. Add a mode toggle above the existing form.
4. In photo mode, show a `<label>` wrapping a hidden `<input type="file" accept="image/*" capture="environment">` styled as a button. When a file is selected, immediately start the upload+OCR flow.
5. After OCR completes, enter `tag_confirm` phase with a simple inline tag editor. "Confirm →" calls the existing `runTransform` with `confirmed_tags` and `skill_name` left to auto.
6. The `tag_confirm` UI is inline — not the existing `TagConfirm` component (which is a post-transform component that persists tags to an existing artifact). This pre-transform tag confirm just collects the user's tag choices before the transform call.

The `runTransform` function signature stays unchanged. The `confirmed_tags` are passed as part of the `body` in the existing fetch call — add `if (confirmedTags.length) body.confirmed_tags = confirmedTags;` to the body construction.

`mapErrorMessage` is already imported and handles error messages.

- [ ] **Step 1: Replace `CaptureShell` and related code in `apps/web/src/app/capture/page.tsx`**

Replace only the `Phase` type definition, the `CaptureShell` function, and add the new `PhotoIdleView` and `PreTransformTagConfirm` functions. Do **not** touch `ResultView`, `Flashcard`, `QuizCard`, `ErrorView`, `TransformingView`, `SkillToggle`, or `styles`.

**Replace the existing `type Phase` block** (lines ~17–22 of the current file) with:

```typescript
type CaptureMode = "text" | "photo";

type Phase =
  | { status: "idle" }
  | { status: "uploading" }
  | { status: "scanning" }
  | { status: "tag_confirm"; extractedText: string; suggestedTags: string[] }
  | { status: "submitting" }
  | { status: "result"; data: TransformResult }
  | { status: "error"; message: string };
```

**Add this import** at the top of the file (alongside the other lib imports):

```typescript
import { uploadAndOcr } from "@/lib/photoUpload";
```

**Replace the entire `CaptureShell` function** with:

```typescript
function CaptureShell({
  getToken,
  initialText,
  initialSkill,
  sourceArtifactId,
}: {
  getToken: () => Promise<string | null>;
  initialText: string;
  initialSkill: SkillChoice;
  sourceArtifactId?: string;
}) {
  const [mode, setMode] = useState<CaptureMode>("text");
  const [text, setText] = useState(initialText);
  const [skill, setSkill] = useState<SkillChoice>(initialSkill);
  const [phase, setPhase] = useState<Phase>({ status: "idle" });

  async function runTransform(
    submitText: string,
    submitSkill: SkillChoice,
    confirmedTags: string[] = [],
  ) {
    setPhase({ status: "submitting" });
    try {
      const token = await getToken();
      const body: Record<string, unknown> = { text: submitText.trim(), tier: "free" };
      if (submitSkill !== "auto") body.skill_name = submitSkill;
      if (sourceArtifactId) body.source_artifact_id = sourceArtifactId;
      if (confirmedTags.length) body.confirmed_tags = confirmedTags;
      const res = await fetch(`${API_URL}/api/v1/captures/transform`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        setPhase({ status: "error", message: mapErrorMessage(res.status) });
        return;
      }
      const data: TransformResult = await res.json();
      setPhase({ status: "result", data });
    } catch {
      setPhase({ status: "error", message: mapErrorMessage(0) });
    }
  }

  async function handlePhotoFile(file: File) {
    setPhase({ status: "uploading" });
    try {
      const token = await getToken();
      setPhase({ status: "scanning" });
      const { extracted_text, suggested_tags } = await uploadAndOcr(file, token);
      setPhase({ status: "tag_confirm", extractedText: extracted_text, suggestedTags: suggested_tags });
    } catch {
      setPhase({ status: "error", message: mapErrorMessage(0) });
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    runTransform(text, skill);
  }

  function handleAlsoMake(chosenSkill: SkillName) {
    setSkill(chosenSkill);
    if (phase.status === "result") runTransform(text, chosenSkill);
  }

  function reset() {
    setText("");
    setSkill("auto");
    setPhase({ status: "idle" });
  }

  return (
    <div style={styles.shell}>
      <AppNav active="capture" />
      {DEV_MODE && (
        <div style={styles.devBar}>
          <a href="/skill-test" style={styles.devLink}>Skill Tester ↗</a>
        </div>
      )}
      <main style={styles.main}>
        {phase.status === "idle" ? (
          <div style={styles.form}>
            <ModeToggle mode={mode} onChange={(m) => { setMode(m); setPhase({ status: "idle" }); }} />
            {mode === "text" ? (
              <form onSubmit={handleSubmit} style={{ display: "contents" }}>
                <label style={styles.label} htmlFor="capture-text">
                  What did you just learn or get wrong?
                </label>
                <textarea
                  id="capture-text"
                  style={styles.textarea}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="e.g. I confused 'affect' and 'effect' again..."
                  rows={4}
                  autoFocus
                />
                <SkillToggle selected={skill} onChange={setSkill} />
                <button
                  type="submit"
                  style={{ ...styles.button, opacity: !text.trim() ? 0.6 : 1 }}
                  disabled={!text.trim()}
                >
                  Transform →
                </button>
              </form>
            ) : (
              <PhotoIdleView onFile={handlePhotoFile} />
            )}
          </div>
        ) : phase.status === "uploading" ? (
          <StatusView message="Uploading photo…" />
        ) : phase.status === "scanning" ? (
          <StatusView message="Scanning text from photo…" />
        ) : phase.status === "tag_confirm" ? (
          <PreTransformTagConfirm
            extractedText={phase.extractedText}
            suggestedTags={phase.suggestedTags}
            onConfirm={(tags) => runTransform(phase.extractedText, "auto", tags)}
            onCancel={reset}
          />
        ) : phase.status === "submitting" ? (
          <TransformingView />
        ) : phase.status === "result" ? (
          <ResultView data={phase.data} onReset={reset} onAlsoMake={handleAlsoMake} getToken={getToken} />
        ) : (
          <ErrorView message={phase.message} onReset={reset} />
        )}
      </main>
    </div>
  );
}
```

**Add these new helper components** before the `SkillToggle` function:

```typescript
function ModeToggle({
  mode,
  onChange,
}: {
  mode: CaptureMode;
  onChange: (m: CaptureMode) => void;
}) {
  return (
    <div style={styles.toggleGroup} role="group" aria-label="Capture mode">
      {(["text", "photo"] as CaptureMode[]).map((m) => (
        <button
          key={m}
          type="button"
          onClick={() => onChange(m)}
          style={{
            ...styles.toggleButton,
            ...(mode === m ? styles.toggleButtonActive : {}),
          }}
        >
          {m === "text" ? "Text" : "Photo"}
        </button>
      ))}
    </div>
  );
}

function PhotoIdleView({ onFile }: { onFile: (f: File) => void }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <p style={styles.label}>Snap or upload a photo of your notes</p>
      <label
        style={{
          ...styles.button,
          display: "inline-block",
          textAlign: "center",
          cursor: "pointer",
        }}
      >
        Choose photo →
        <input
          type="file"
          accept="image/*"
          capture="environment"
          style={{ display: "none" }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onFile(file);
          }}
        />
      </label>
      <p style={{ fontSize: "0.8125rem", color: "#aaa" }}>
        On mobile, this opens your camera directly.
      </p>
    </div>
  );
}

function StatusView({ message }: { message: string }) {
  return (
    <div style={styles.progressContainer}>
      <div className="spinner" />
      <p style={styles.progressMessage}>{message}</p>
    </div>
  );
}

function PreTransformTagConfirm({
  extractedText,
  suggestedTags,
  onConfirm,
  onCancel,
}: {
  extractedText: string;
  suggestedTags: string[];
  onConfirm: (tags: string[]) => void;
  onCancel: () => void;
}) {
  const [tags, setTags] = useState<string[]>(suggestedTags);
  const [newTag, setNewTag] = useState("");

  function addTag(name: string) {
    const clean = name.trim().toLowerCase();
    if (!clean || tags.includes(clean)) return;
    setTags((prev) => [...prev, clean]);
  }

  function removeTag(name: string) {
    setTags((prev) => prev.filter((t) => t !== name));
  }

  return (
    <div style={{ ...styles.form, maxWidth: 520 }}>
      <p style={styles.label}>Text extracted from photo</p>
      <p
        style={{
          fontSize: "0.875rem",
          color: "#555",
          background: "#f9fafb",
          borderRadius: 8,
          padding: "0.75rem",
          border: "1px solid #e5e7eb",
          whiteSpace: "pre-wrap",
          maxHeight: 160,
          overflowY: "auto",
        }}
      >
        {extractedText}
      </p>
      <p style={styles.label}>Confirm tags before transforming</p>
      <div style={styles.toggleGroup}>
        {tags.map((tag) => (
          <span
            key={tag}
            style={{
              ...styles.toggleButton,
              ...styles.toggleButtonActive,
              display: "inline-flex",
              alignItems: "center",
              gap: "0.25rem",
            }}
          >
            {tag}
            <button
              type="button"
              onClick={() => removeTag(tag)}
              style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", padding: 0, fontSize: "1rem", lineHeight: 1 }}
              aria-label={`Remove ${tag}`}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <div style={{ display: "flex", gap: "0.375rem" }}>
        <input
          style={styles.textarea}
          value={newTag}
          onChange={(e) => setNewTag(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addTag(newTag);
              setNewTag("");
            }
          }}
          placeholder="Add tag…"
          rows={1}
        />
        {newTag.trim() && (
          <button
            type="button"
            style={styles.button}
            onClick={() => { addTag(newTag); setNewTag(""); }}
          >
            Add
          </button>
        )}
      </div>
      <div style={{ display: "flex", gap: "0.75rem" }}>
        <button
          type="button"
          style={{ ...styles.button, opacity: tags.length === 0 ? 0.6 : 1 }}
          disabled={tags.length === 0}
          onClick={() => onConfirm(tags)}
        >
          Confirm →
        </button>
        <button
          type="button"
          style={{ ...styles.button, background: "#fff", color: "#555", border: "1.5px solid #ddd" }}
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd apps/web
pnpm typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/capture/page.tsx
git commit -m "feat(web): add photo capture mode — file input, S3 upload, OCR, tag confirm, transform"
```

---

## Self-Review

### Spec coverage check

| Acceptance criterion | Covered by |
|---|---|
| Photo capture mode available | ✅ Task 5 — Photo mode toggle on capture page |
| Camera UI opens; one tap captures | ✅ Task 5 — `<input type="file" capture="environment">` |
| Photo uploads to S3 via presigned URL | ✅ Task 4 — `uploadAndOcr` uses `POST /upload-url` + S3 PUT |
| `ocr-extract` skill extracts text | ✅ Task 2 — `OcrExtractSkill` via `call_vision` |
| Extracted text flows into infer → generate | ✅ Task 3 endpoint → Task 5 calls existing `/transform` |
| Tag confirm screen after OCR, before transform | ✅ Task 5 — `PreTransformTagConfirm` phase |
| Fast transforms show inline result | ✅ Existing `ResultView` reused |
| Integration: sample photo → OCR text → artifact | ✅ Backend endpoint tests in Task 3 cover OCR + tag flow |

**Mobile out of scope:** Confirmed. The mobile photo capture (Expo `expo-camera`) should be filed as a separate backlog issue referencing this plan as prior art.
