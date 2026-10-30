from backend.database import init_db
import os

from flask import Flask, jsonify
from flask_cors import CORS

from backend.offline.join import create_blueprint


def create_app():
    app = Flask(__name__)

    init_db()

    CORS(app)

    # Register existing offline QR join functionality
    app.register_blueprint(create_blueprint())

    @app.get("/api/health")
    def health():
        return jsonify({
            "status": "ok",
            "offline_mode": os.getenv("OFFLINE_MODE", "0") == "1"
        })

    return app


app = create_app()


if __name__ == "__main__":
    app.run(
        host="0.0.0.0",
        port=int(os.getenv("PORT", "5000")),
        debug=False
    )