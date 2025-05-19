from fastapi import FastAPI
from pydantic import BaseModel
from SB_tools import SB_info

app = FastAPI()

class TextInput(BaseModel):
    text:str

@app.post("/typecheck")
def type_check(_input:TextInput):
    if(not SB.include_in_all_words(_input.text)):return {"include":False}

    ret = {"include":True}
    ret["type1"] = "暴力"
    ret["type2"] = ""
    return ret

SB = SB_info()