"""The /api/data/* routes, shared by the local server (`server/main.py`) and the Vercel function (`api/index.py`)."""
import os

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from . import cas_common, compound_search
from .data_proxy import NistWebBookClient, UnifiedPropertyResolver
from .security import verify_token

router = APIRouter()


def data_capabilities() -> dict:
    """What this server can look up (the frontend reads it from /api/health to choose its sources)."""
    return {
        "nist": os.environ.get("RC_NIST", "1") != "0",
        "cas": cas_common.enabled(),
        "search": True,
    }


class ResolveCompoundRequest(BaseModel):
    name: str = ""
    formula: str = ""
    smiles: str = ""
    inchikey: str = ""
    cas: str = ""


@router.get("/api/data/search")
def search_compounds(q: str = "", _token: str = Depends(verify_token)):
    """Hits from NIST WebBook and CAS Common Chemistry for a name, formula, CAS number or InChIKey, plus the status of
    each source ('ok' | 'none' | 'error' | 'disabled', with a message)."""
    if len(q.strip()) > 120:
        raise HTTPException(status_code=400, detail="Query too long")
    return compound_search.search(q)


@router.get("/api/data/nist-webbook")
def get_nist_webbook(
    identifier: str = "",
    cas: str = "",
    inchikey: str = "",
    formula: str = "",
    name: str = "",
    _token: str = Depends(verify_token),
):
    query_val = cas or inchikey or formula or name or identifier
    by = "cas" if cas else ("inchikey" if inchikey else ("formula" if formula else "name"))
    if not query_val:
        raise HTTPException(status_code=400, detail="Missing identifier for NIST lookup")
    res = NistWebBookClient.lookup(query_val, by=by)
    if not res:
        raise HTTPException(status_code=404, detail="Compound not found in NIST Chemistry WebBook")
    return res


@router.get("/api/data/properties")
def get_properties(
    name: str = "",
    formula: str = "",
    smiles: str = "",
    inchikey: str = "",
    cas: str = "",
    _token: str = Depends(verify_token),
):
    return UnifiedPropertyResolver.resolve_compound(
        name=name, formula=formula, smiles=smiles, inchikey=inchikey, cas=cas
    )


@router.post("/api/data/resolve-compound")
def resolve_compound(req: ResolveCompoundRequest, _token: str = Depends(verify_token)):
    return UnifiedPropertyResolver.resolve_compound(
        name=req.name, formula=req.formula, smiles=req.smiles, inchikey=req.inchikey, cas=req.cas
    )
