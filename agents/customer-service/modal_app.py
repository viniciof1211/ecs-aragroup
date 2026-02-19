# Modal deployment for Customer Service — ARA Group Costa Rica
# Connects to AUREA cotizador for quotes

import modal
import fastapi
import os
from datetime import datetime

app = modal.App("customer-service")
web_app = fastapi.FastAPI()

image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install_from_requirements("requirements.txt")
)

@app.function(
    image=image,
    secrets=[modal.Secret.from_name("customer-service-secrets")],
    timeout=120,
)
@modal.asgi_app()
def serve():
    from agent import customer_service

    @web_app.get("/health")
    async def health():
        return {
            "status": "healthy",
            "agent": "Customer Service — ARA Group",
            "timestamp": datetime.utcnow().isoformat(),
            "tools": 2,
            "tools_list": ["aurea_cotizador", "catalog_search"],
            "model": os.environ.get("OPENAI_MODEL", "gpt-4o-mini"),
            "aurea_url": "https://levinnovation--aurea-cotizador-fa8549b3.modal.run",
        }

    @web_app.post("/invoke")
    async def invoke(request: fastapi.Request):
        body = await request.json()
        message = body.get("message", "")
        thread_id = body.get("thread_id", "default")
        
        if not message:
            return {"error": "message field is required"}
        
        config = {"configurable": {"thread_id": thread_id}}
        result = customer_service.invoke(
            {"messages": [{"role": "user", "content": message}]},
            config=config,
        )
        
        last_msg = result["messages"][-1]
        return {
            "response": last_msg.content,
            "thread_id": thread_id,
        }

    @web_app.post("/quote")
    async def quote(request: fastapi.Request):
        """Convenience endpoint that directly asks for a quote."""
        body = await request.json()
        description = body.get("description", "")
        if not description:
            return {"error": "description field is required"}
        
        message = f"Necesito una cotización para: {description}"
        if body.get("budget_range"):
            message += f". Mi presupuesto es {body['budget_range']}"
        if body.get("style"):
            message += f". Estilo: {body['style']}"
        if body.get("dimensions"):
            message += f". Dimensiones: {body['dimensions']}"
        
        config = {"configurable": {"thread_id": body.get("thread_id", "quote")}}
        result = customer_service.invoke(
            {"messages": [{"role": "user", "content": message}]},
            config=config,
        )
        
        return {
            "response": result["messages"][-1].content,
            "thread_id": config["configurable"]["thread_id"],
        }

    return web_app
