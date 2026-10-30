import os

class Config:
    OFFLINE_MODE = os.getenv("OFFLINE_MODE", "0") == "1"
    DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///reliefos.db")
    STALE_HOURS = float(os.getenv("STALE_HOURS", "6"))
    PORT = int(os.getenv("PORT", "5000"))
    SCENARIO = os.getenv("SCENARIO", "punjab_flood_sim")
    HOST_IP = os.getenv("RELIEFOS_HOST_IP", "")
