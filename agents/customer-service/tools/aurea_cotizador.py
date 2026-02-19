# Tool: aurea_cotizador
# Connects to AUREA quotes system to generate kitchen/furniture quotes
# AUREA endpoint: https://levinnovation--aurea-knowledge-base.modal.run

import logging
import httpx
from typing import Optional
from langchain_core.tools import tool

logger = logging.getLogger(__name__)

AUREA_URL = "https://levinnovation--aurea-knowledge-base.modal.run"


@tool
def aurea_cotizador(
    description: str,
    budget_range: Optional[str] = None,
    style: Optional[str] = None,
    dimensions: Optional[str] = None,
) -> str:
    """Generate a kitchen/furniture quote using the AUREA cotizador system.
    
    Use this tool when a customer asks for a quote, price, cotización, or wants to know
    how much something costs. Provide the description of what they want.
    
    Args:
        description: What the customer wants quoted (e.g. "cocina integral moderna 3 metros")
        budget_range: Optional budget range (e.g. "$5000-$10000" or "₡3M-₡5M")
        style: Optional style preference (e.g. "moderno", "clásico", "minimalista")
        dimensions: Optional dimensions (e.g. "3m x 2.5m", "largo 4m")
    
    Returns:
        A formatted quote response from AUREA with pricing and details.
    """
    try:
        logger.info(f"Requesting AUREA quote: {description}")
        
        payload = {
            "description": description,
            "budget_range": budget_range,
            "style": style,
            "dimensions": dimensions,
        }
        # Remove None values
        payload = {k: v for k, v in payload.items() if v is not None}
        
        # Try /quote endpoint first
        with httpx.Client(timeout=30.0) as client:
            # Try POST /quote
            try:
                response = client.post(f"{AUREA_URL}/quote", json=payload)
                if response.status_code == 200:
                    data = response.json()
                    return _format_quote_response(data)
            except Exception:
                pass
            
            # Try POST /invoke (generic agent endpoint)
            try:
                response = client.post(
                    f"{AUREA_URL}/invoke",
                    json={
                        "message": f"Genera una cotización para: {description}. "
                                   f"{'Presupuesto: ' + budget_range + '. ' if budget_range else ''}"
                                   f"{'Estilo: ' + style + '. ' if style else ''}"
                                   f"{'Dimensiones: ' + dimensions + '.' if dimensions else ''}",
                        "thread_id": "aurea-quote",
                    }
                )
                if response.status_code == 200:
                    data = response.json()
                    return data.get("response", str(data))
            except Exception:
                pass
            
            # Try GET /health to verify service is up
            try:
                health = client.get(f"{AUREA_URL}/health")
                if health.status_code == 200:
                    # Service is up but endpoints differ — use /invoke with context
                    response = client.post(
                        f"{AUREA_URL}/invoke",
                        json={"message": f"Cotización: {description}", "thread_id": "quote"}
                    )
                    if response.status_code == 200:
                        return response.json().get("response", str(response.json()))
            except Exception:
                pass
        
        return (
            f"No pude conectar con el sistema AUREA en este momento. "
            f"Sin embargo, puedo ayudarte con información general sobre: {description}. "
            f"Te recomiendo contactar directamente a un asesor para una cotización formal."
        )
        
    except Exception as e:
        logger.error(f"Error in aurea_cotizador: {e}")
        return (
            f"Hubo un error al generar la cotización. "
            f"Por favor contacta a un asesor directamente para: {description}. "
            f"Error técnico: {str(e)}"
        )


def _format_quote_response(data: dict) -> str:
    """Format AUREA API response into a readable quote."""
    if isinstance(data, str):
        return data
    
    parts = ["📋 **Cotización AUREA**\n"]
    
    if "items" in data:
        for item in data["items"]:
            name = item.get("name", "Artículo")
            price = item.get("price", "Consultar")
            qty = item.get("quantity", 1)
            parts.append(f"• {name} (x{qty}): {price}")
    
    if "total" in data:
        parts.append(f"\n💰 **Total: {data['total']}**")
    
    if "notes" in data:
        parts.append(f"\n📝 {data['notes']}")
    
    if "validity" in data:
        parts.append(f"⏰ Válido hasta: {data['validity']}")
    
    if "description" in data and "items" not in data:
        parts.append(data["description"])
    
    if "response" in data:
        parts.append(data["response"])
    
    return "\n".join(parts) if len(parts) > 1 else str(data)
