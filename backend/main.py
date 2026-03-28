from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import engine, Base
from routers import auth, chat, websocket, keys

# Initialize database tables
Base.metadata.create_all(bind=engine)

app = FastAPI()

# Configure CORS to allow cross-origin requests from the frontend client
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Route handlers for different application features
app.include_router(auth.router)
app.include_router(chat.router)
app.include_router(websocket.router)
app.include_router(keys.router)

@app.get("/")
def read_root():
    return {"status": "Server is running properly"}