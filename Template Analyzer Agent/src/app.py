from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import logging
from .routers import analysis
from .database import engine, Base
# Import all models to register them with Base.metadata
from .models.db_models import Template, TemplateField, TemplateSection, TemplateUserFieldValue

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Master Template Analyser Agent")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Allow all origins for dev
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Tables are created by migrations / Backend; we do not run create_all to avoid schema conflicts.
@app.on_event("startup")
async def startup():
    logger.info("Database connection ready (admin templates only).")

app.include_router(analysis.router)

@app.get("/")
async def root():
    return {"message": "Antigravity Agent is active."}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

    ##
