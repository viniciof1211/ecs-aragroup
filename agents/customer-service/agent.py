# Customer Service Agent — ARA Group Costa Rica
# Handles WhatsApp customer inquiries with AUREA quotes integration

import os
import logging
from typing import Dict, Any, Optional
from langchain_openai import ChatOpenAI
from langgraph.graph import StateGraph, MessagesState, START, END
from langgraph.prebuilt import ToolNode
from langgraph.checkpoint.memory import MemorySaver

from tools.aurea_cotizador import aurea_cotizador
from tools.catalog_search import catalog_searchTool

logger = logging.getLogger(__name__)

# ─── Model Configuration ─────────────────────────────────
llm = ChatOpenAI(
    model=os.environ.get("OPENAI_MODEL", "gpt-4o-mini"),
    temperature=0.7,
    max_tokens=4096,
)

# ─── System Prompt ────────────────────────────────────────
SYSTEM_PROMPT = """Eres el asistente virtual de ARA Group Costa Rica, una empresa líder en cocinas integrales, muebles de diseño y remodelaciones.

INSTRUCCIONES IMPORTANTES:
- Responde SIEMPRE en español costarricense, de forma amable, profesional y cálida.
- Usa "usted" como forma de tratamiento.
- Tu objetivo principal es ayudar al cliente y avanzar hacia una cotización o cita.

CAPACIDADES:
1. **Cotizaciones**: Cuando el cliente pregunte por precios, costos o cotizaciones, usa la herramienta `aurea_cotizador` para generar una cotización del sistema AUREA.
2. **Catálogo**: Puedes buscar productos en el catálogo con `catalog_searchTool`.
3. **Información general**: Horarios, ubicaciones, proceso de compra, garantías, etc.

INFORMACIÓN DE LA EMPRESA:
- Marcas: ARA Cocinas, Hogares Funcionales
- Productos: Cocinas integrales, closets, muebles de baño, centros de entretenimiento, muebles a medida
- Ubicación: Escazú, San José, Costa Rica
- Horario: Lunes a Viernes 8am-5pm, Sábado 9am-1pm
- Proceso: Consulta → Diseño 3D → Cotización → Fabricación → Instalación
- Garantía: 5 años en estructura, 2 años en herrajes

REGLAS:
- Si el cliente pide una cotización, SIEMPRE usa la herramienta aurea_cotizador.
- Si no puedes resolver algo, ofrece conectar con un asesor humano.
- Nunca inventes precios — usa siempre la herramienta de cotización.
- Sé conciso pero completo en tus respuestas.
- Si el cliente muestra interés, sugiere agendar una visita al showroom o una visita a domicilio."""

# ─── Tools ────────────────────────────────────────────────
tools = [
    aurea_cotizador,
    catalog_searchTool,
]

llm_with_tools = llm.bind_tools(tools)

# ─── Graph Definition ────────────────────────────────────
def call_model(state: MessagesState):
    """Call the LLM with tools bound."""
    from langchain_core.messages import SystemMessage
    messages = [SystemMessage(content=SYSTEM_PROMPT)] + state["messages"]
    response = llm_with_tools.invoke(messages)
    return {"messages": [response]}

def should_continue(state: MessagesState):
    """Check if we should continue to tools or end."""
    last = state["messages"][-1]
    if hasattr(last, "tool_calls") and last.tool_calls:
        return "tools"
    return END

# ─── Build Graph ─────────────────────────────────────────
graph = StateGraph(MessagesState)
graph.add_node("agent", call_model)
graph.add_node("tools", ToolNode(tools))
graph.add_edge(START, "agent")
graph.add_conditional_edges("agent", should_continue, {"tools": "tools", END: END})
graph.add_edge("tools", "agent")

checkpointer = MemorySaver()
customer_service = graph.compile(checkpointer=checkpointer)
