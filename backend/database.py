import os
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

DATABASE_URL = os.environ.get("DATABASE_URL", f"sqlite:///{ROOT_DIR / 'loyaltyshield.db'}")

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
