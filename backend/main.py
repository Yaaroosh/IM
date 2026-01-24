from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import engine, Base
from routers import auth, chat, websocket

# יצירת הטבלאות
Base.metadata.create_all(bind=engine)

app = FastAPI()

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# חיבור הראוטרים
app.include_router(auth.router)
app.include_router(chat.router)
app.include_router(websocket.router)

@app.get("/")
def read_root():
    return {"status": "Server is running properly"}