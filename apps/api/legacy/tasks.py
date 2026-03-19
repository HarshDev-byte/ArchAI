"""
Celery task definitions — business logic will be wired here.
"""
from celery_app import celery_app


@celery_app.task(bind=True, name="tasks.run_feasibility_check")
def run_feasibility_check(self, parcel_geojson: dict) -> dict:
    """Placeholder: AI feasibility analysis via Claude."""
    raise NotImplementedError("Implement in Phase 2")


@celery_app.task(bind=True, name="tasks.generate_layouts")
def generate_layouts(self, parcel_geojson: dict, feasibility_result: dict) -> dict:
    """Placeholder: Generate 3 building layout configurations."""
    raise NotImplementedError("Implement in Phase 2")


@celery_app.task(bind=True, name="tasks.export_pdf")
def export_pdf(self, layout_id: str) -> str:
    """Placeholder: Render PDF report for a layout."""
    raise NotImplementedError("Implement in Phase 2")
