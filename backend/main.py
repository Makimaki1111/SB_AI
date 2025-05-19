from fastapi import FastAPI
from pydantic import BaseModel
try:
    from SB_info import SB_info
    from GOOGLE_API import GOOGLE_AI
except ImportError:
    from backend.SB_info import SB_info
    from backend.GOOGLE_API import GOOGLE_AI
from collections import defaultdict

app = FastAPI()

class TextInput(BaseModel):
    text:str

@app.post("/include_check")
def include_check(_input:TextInput):
    ret = {
        "include" : False, 
        "used" : False,
        "type1" : "",
        "type2" : ""
    }

    if(_input.text in used):
        ret["include"] = True
        ret["used"] = True
        ret["type1"] = used[_input.text][0]
        ret["type2"] = used[_input.text][1]
    else:
        ret["include"] = SB.include_in_all_words(_input.text)

    return ret

@app.post("/typecheck")
def type_check(_input:TextInput):
    ret = {
        "include" : False, 
        "used" : False,
        "type1" : "",
        "type2" : ""
    }

    # 辞書に登録されていない
    if(not SB.include_in_all_words(_input.text)):return ret
    ret["include"] = True

    # 使用済み
    if(_input.text in used):
        ret["used"] = True
        ret["type1"] = used[_input.text][0]
        ret["type2"] = used[_input.text][1]
        return ret

    types = AI.get_type(_input.text)
    ret["type1"] = types[0]
    ret["type2"] = types[1] if len(types) == 2 else ""
    used[_input.text] = (ret["type1"],ret["type2"])
    return ret

SB = SB_info()
AI = GOOGLE_AI()
used = defaultdict(list)