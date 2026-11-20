"""为本地抢车位联调准备副驾，并用宠物家园接口验证数据完整性。"""

import re
from pathlib import Path


def prepare_parking_passenger(user, request, sql):
    owner = user["uid"]
    if not re.fullmatch(r"[1-9][0-9]{0,18}", owner):
        raise ValueError("测试账号编号无效")
    if not re.fullmatch(r"fishpi_parking_check_[0-9]+", sql("SELECT DATABASE()")):
        raise ValueError("请连接本地抢车位隔离库")
    token = user["token"]
    if request("/api/v3/me", token=token)["id"] != owner:
        raise ValueError("登录身份与测试账号编号不一致")
    initial_food = request("/api/v3/pets/catalog", token=token)["rules"]["initialFood"]
    if type(initial_food) is not int or initial_food < 0:
        raise ValueError("宠物目录缺少有效的初始口粮数量")

    script = Path(__file__).with_name("parking-passenger.sql").read_text(encoding="utf-8")
    sql(f"SET @test_owner='{owner}', @initial_food={initial_food};\n" + script)
    home = request("/api/v3/me/pet", token=token)
    if not home["pet"] or not any(item["itemId"] == "food" for item in home["inventory"]):
        raise RuntimeError("测试账号的宠物或口粮未准备好")
    return home
