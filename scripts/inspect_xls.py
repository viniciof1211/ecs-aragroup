"""Inspect the Bitrix24 XLS export to understand data shape."""
import pandas as pd

FILE = r"C:\Users\vinicio.flores\Downloads\LEAD_20260218_9c3c2dc1_6995e080048d8.xls"
df = pd.read_html(FILE, encoding="utf-8")[0]

print("=== Date range ===")
df["Creado_dt"] = pd.to_datetime(df["Creado"], format="%d/%m/%Y %H:%M:%S", errors="coerce")
df["Modificado_dt"] = pd.to_datetime(df["Modificado"], format="%d/%m/%Y %H:%M:%S", errors="coerce")
df["UltimoContacto_dt"] = pd.to_datetime(df["Último contacto"], format="%d/%m/%Y %H:%M:%S", errors="coerce")
df["FechaCambioEtapa_dt"] = pd.to_datetime(df["Fecha de cambio de la etapa"], format="%d/%m/%Y %H:%M:%S", errors="coerce")
print(f"Creado min: {df['Creado_dt'].min()}, max: {df['Creado_dt'].max()}")
print(f"Modificado min: {df['Modificado_dt'].min()}, max: {df['Modificado_dt'].max()}")
print(f"UltimoContacto min: {df['UltimoContacto_dt'].min()}, max: {df['UltimoContacto_dt'].max()}")
print(f"FechaCambioEtapa min: {df['FechaCambioEtapa_dt'].min()}, max: {df['FechaCambioEtapa_dt'].max()}")

print("\n=== Responsable (Employee) top 20 ===")
print(df["Responsable"].value_counts().head(20).to_string())

print("\n=== Comentario samples ===")
comments = df["Comentario"].dropna()
print(f"Non-null: {len(comments)} / {len(df)}")
for v in list(comments.unique())[:25]:
    print(f"  {repr(v)}")

print("\n=== Total (monetary) stats ===")
totals = pd.to_numeric(df["Total"], errors="coerce")
nz = totals[totals > 0]
print(f"Non-zero: {len(nz)}, Max: {totals.max()}, Mean non-zero: {nz.mean() if len(nz) else 0:.2f}")

print("\n=== Contact info coverage ===")
contact_cols = ["Móvil", "E-mail del trabajo", "Teléfono del trabajo",
                "Página del Facebook", "Cuenta de Telegram",
                "Comentarios de Instagram", "Chat en vivo",
                "Contacto de Viber", "Cuenta de Canal Abierto"]
for c in contact_cols:
    if c in df.columns:
        print(f"  {c}: {df[c].notna().sum()} / {len(df)}")

print("\n=== Etapa cambiada por ===")
print(df["Etapa cambiada por"].value_counts().head(15).to_string())

print("\n=== Más información sobre esta etapa (samples) ===")
info = df["Más información sobre esta etapa"].dropna()
print(f"Non-null: {len(info)}")
for v in list(info.unique())[:15]:
    print(f"  {repr(v)}")

print("\n=== Información de origen (samples) ===")
src_info = df["Información de origen"].dropna()
print(f"Non-null: {len(src_info)}")
for v in list(src_info.unique())[:15]:
    print(f"  {repr(v)}")

print("\n=== Producto Vendido ===")
pv = df["Producto Vendido"].dropna()
print(f"Non-null: {len(pv)}")
print(pv.value_counts().head(15).to_string())

print("\n=== Que estamos Diseñando ===")
qd = df["Que estamos Diseñando"].dropna()
print(f"Non-null: {len(qd)}")
for v in list(qd.unique())[:15]:
    print(f"  {repr(v)}")

print("\n=== Perfil ===")
pf = df["Perfil"].dropna()
print(f"Non-null: {len(pf)}")
print(pf.value_counts().head(15).to_string())

print("\n=== Tipo de Proyecto ===")
tp = df["Tipo de Proyecto"].dropna()
print(f"Non-null: {len(tp)}")
print(tp.value_counts().head(15).to_string())

print("\n=== porque no compro ===")
pnc = df["porque no compro"].dropna()
print(f"Non-null: {len(pnc)}")
print(pnc.value_counts().head(15).to_string())

print("\n=== Creado por el formulario del CRM ===")
form = df["Creado por el formulario del CRM"].dropna()
print(f"Non-null: {len(form)}")
print(form.value_counts().head(10).to_string())

print("\n=== UTM columns ===")
for c in ["UTM Source", "UTM Medium", "UTM Campaign"]:
    vals = df[c].dropna()
    print(f"  {c}: {len(vals)} non-null, top: {vals.value_counts().head(5).to_dict()}")
