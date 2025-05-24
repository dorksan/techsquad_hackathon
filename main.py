from fastapi import HTTPException
from fastapi.responses import StreamingResponse
import httpx
from pathlib import Path
from fastapi.params import Cookie
from fastapi.templating import Jinja2Templates
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi import FastAPI, Request, UploadFile, File
from typing import Optional
from fastapi.responses import FileResponse
import io
import json
import os

import testJson
from User import User

# Версия фронта (увеличить, чтобы перезаписать кеш браузера)
version = "0.7.9.1"

# Адрес бэка
# server = "http://127.0.0.1:8001"
server = os.getenv("BACKEND_URL", "http://127.0.0.1:8001")
app = FastAPI()

app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="front")
users = {}
# Загрузка начальной страницы
@app.get("/", response_class=HTMLResponse)
async def read_root(
        request: Request,
        userId: Optional[int] = Cookie(default=None)
):
    if userId is None or userId not in users:
        user = User()
        print(f"Create User {user.id}")
        users[user.id] = user
        response = templates.TemplateResponse("index.html", {"request": request, "version": version})
        response.set_cookie("userId", str(user.id))
        return response

    user = users[userId]
    print(f"Get User {user.id}")
    return templates.TemplateResponse("index.html", {"request": request, "version": version})

# Отправка изображения и получение полигонов
@app.post("/upload-image")
async def upload_image(
    request: Request,
    file: UploadFile = File(...),
    userId: Optional[int] = Cookie(default=None)
):
    print(f"Upload {file.filename}")
    if file.content_type != "image/png":
        raise HTTPException(400, "Для загрузки разрешены только PNG изображения!")

    # Проверяем наличие userId
    if userId is None:
        raise HTTPException(400, "userId cookie не передан!")

    try:
        file_bytes = await file.read()
        files = {'file': (file.filename, file_bytes, file.content_type)}
        data = {'user_id': str(userId)}

        print(f"Send {file.filename} and user {userId}")
        timeout = httpx.Timeout(60.0)
        async with httpx.AsyncClient() as client:
            response = await client.post(
                server + "/upload",
                files=files,
                data=data,
                timeout=timeout
            )
            response.raise_for_status()
            return response.json()['polygons']
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Server error: {str(e)}"
        ) from e

@app.post("/upload-image-test")
async def upload_image(
    request: Request,
    file: UploadFile = File(...),
    userId: Optional[int] = Cookie(default=None)
):
    return testJson.TestJson


@app.post("/generate-docx")
async def generate_docx(
        request: Request,
        userId: Optional[int] = Cookie(default=None)
):
    data = await request.json()
    image_name = data["image_name"]
    image_name = image_name.rsplit('.', 1)[0]
    polygons = data["data"]

    async with httpx.AsyncClient() as client:
        # 1. Подтверждение полигонов
        confirm_response = await client.post(
            server + "/confirm",
            data={
                "user_id": str(userId),
                "image_name": image_name,
                "polygons_json": json.dumps(polygons)
            }
        )

        if confirm_response.status_code != 200:
            raise HTTPException(400, "Ошибка подтверждения данных")

        # 2. Генерация отчёта
        report_response = await client.post(
            server + "/generate-report",
            data={
                "user_id": str(userId),
                "image_name": image_name
            }
        )

        if report_response.status_code != 200:
            raise HTTPException(500, "Ошибка генерации отчёта")

        # Сохранение файла
        final_dir = Path("generated_reports")  # Относительный путь
        final_dir.mkdir(exist_ok=True)  # Создать папку

        final_path = final_dir / "report.docx"

        with open(final_path, "wb") as f:
            f.write(report_response.content)

    return FileResponse(
        final_path,
        filename="report.docx",
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    )


@app.post("/generate-docx-test")
async def generate_docx(
    request: Request,
    userId: Optional[int] = Cookie(default=None)
):
    # Чтение JSON из запроса (если нужно)
    data = await request.json()
    print(data)

    # Создаем пустой docx-файл в памяти
    empty_file = io.BytesIO()
    empty_file.name = "empty.docx"
    empty_file.seek(0)

    # Возвращаем пустой файл как ответ
    return StreamingResponse(
        empty_file,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": "attachment; filename=empty.docx"}
    )