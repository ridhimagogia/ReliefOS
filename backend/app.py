"""ReliefOS Flask Application Factory."""
from __future__ import annotations

import os
from flask import Flask, send_from_directory, g
from flask_cors import CORS

from .config import Config
from .models import init_db
from .api import api_bp
from .offline.join import create_blueprint as create_join_blueprint
from .seed.seed import seed_database


def create_app(test_config=None) -> Flask:
    base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    dist_dir = os.path.join(base_dir, "frontend", "dist")

    app = Flask(
        __name__,
        static_folder=dist_dir if os.path.isdir(dist_dir) else None,
        static_url_path=""
    )
    CORS(app)

    # Unicode preservation for Hindi / Devanagari text
    app.json.ensure_ascii = False

    # Apply configuration
    db_url = Config.DATABASE_URL
    if test_config and "DATABASE_URL" in test_config:
        db_url = test_config["DATABASE_URL"]

    db_session_factory = init_db(db_url)

    # Auto-seed Punjab flood scenario if database is empty
    with app.app_context():
        sess = db_session_factory()
        try:
            seed_database(sess, if_empty=True)
        finally:
            sess.close()

    @app.before_request
    def attach_db():
        g.db_session = db_session_factory()

    @app.teardown_appcontext
    def cleanup_db(exception=None):
        sess = g.pop("db_session", None)
        if sess is not None:
            sess.close()

    # Register blueprints
    app.register_blueprint(api_bp)
    app.register_blueprint(create_join_blueprint())

    # Static assets and SPA fallback
    @app.route("/", defaults={"path": ""})
    @app.route("/<path:path>")
    def serve_frontend(path):
        if path.startswith("api/"):
            return {"error": "API route not found"}, 404

        if os.path.isdir(dist_dir):
            file_path = os.path.join(dist_dir, path)
            if path and os.path.isfile(file_path):
                return send_from_directory(dist_dir, path)
            # SPA fallback
            index_file = os.path.join(dist_dir, "index.html")
            if os.path.isfile(index_file):
                return send_from_directory(dist_dir, "index.html")

        return {
            "status": "ReliefOS API online",
            "frontend": "dist not found (run 'npm run build' in frontend/)",
            "health": "/api/health",
            "docs": "/api/demands, /api/stock, /api/locations, /api/match/run"
        }

    return app


# Module-level instance for `flask --app backend.app run`
app = create_app()

if __name__ == "__main__":
    port = int(os.getenv("PORT", "5000"))
    app.run(host="0.0.0.0", port=port, debug=False)
