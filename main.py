from fastapi import FastAPI
from pydantic import BaseModel
from SB_tools import SB_info
from GOOGLE_API import GOOGLE_AI

app = FastAPI()

class TextInput(BaseModel):
    text:str

@app.post("/typecheck")
def type_check(_input:TextInput):
    if(not SB.include_in_all_words(_input.text)):return {"include":False}

    ret = {"include":True}
    types = AI.get_type(_input.text)
    ret["type1"] = types[0]
    ret["type2"] = types[1] if len(types) == 2 else ""
    return ret

SB = SB_info()
AI = GOOGLE_AI()