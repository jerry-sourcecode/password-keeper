# 备份文件格式协议

## UMC 2.0

在「设置」页可将**整个用户数据**导出为 `.umc` 文件（也可导入恢复）。`.umc` 是 UTF-8 JSON 文本，内部结构如下：

```jsonc
{
  "app": "password-keeper",      // 固定标识，用于校验是否为本应用备份
  "version": "2.0",             // 备份格式版本
  "username": "<string>",         // 备份所属的用户名
  "createdAt": "<number>",    // 导出时的毫秒时间戳
  "data": "<string>"  // 加密后的完整数据
}
```

- `data` 字段为**加密串**，不会泄露明文。
- 导入时需使用**正确的当前主密码**解密 `data`，成功后覆盖本地数据并同步到远端。
- 若备份的 `username` 与当前登录账号不一致，或主密码不匹配、文件损坏，导入都会被拒绝，且不会影响现有数据。

### `data` 的加密过程

`data` 加密前为 JSON 序列化的 vault 数据（结构见下节），加密步骤如下：

1. `JSON.stringify` 序列化 vault 数据
2. **gzip 压缩**（`pako`），并加 `gz:` 前缀
3. **base64 编码**
4. **AES 加密**，密钥由主密码经 **SHA-512** 派生
5. 得到的密文写入 `data` 字段

解密即逆向过程：AES 解密 → 识别 `gz:` 前缀 → base64 解码 → inflate 解压 → JSON 解析。

### `data` 加密前的结构

```jsonc
{
    "data": {
        "items": [           // 文件条目数组
            {
                "id": "<string>",          // 条目唯一 ID
                "path": "<string>",        // 完整路径，如 /a/b.txt
                "title": "<string>",       // 文件名
                "type": "<string>",        // 类型：password 或 text
                "data": { ... },           // 条目具体内容（见下）
                "createdAt": "<number>",   // 创建时间戳（毫秒）
                "updatedAt": "<number>"    // 修改时间戳（毫秒）
            }
        ],
        "folders": [         // 文件夹数组
            {
                "id": "<string>",          // 文件夹 ID
                "path": "<string>",        // 完整路径，以 / 结尾
                "name": "<string>",        // 文件夹名
                "createdAt": "<number>",   // 创建时间戳（毫秒）
                "updatedAt": "<number>"    // 修改时间戳（毫秒）
            }
        ]
    }
}
```

`items[].data` 因条目类型不同而不同：

- **`type = "password"`**（`.pwd` 密码条目）：

```jsonc
{
    "username": "<string>",      // 用户名
    "password": "<string>",      // 密码
    "remark": "<string>",        // 备注
    "phone": "<string>",         // 手机号
    "email": "<string>",         // 邮箱
    "url": "<string>",           // 关联网址
    "thirdPartyLogins": [        // 第三方登录关联（可多条）
        {
            "provider": "<string>",  // 登录方式，如 GitHub
            "account": "<string>"    // 第三方账号或说明
        }
    ]
}
```

- **`type = "text"`**（`.md` 文本条目）：

```jsonc
{
    "content": "<string>"   // Markdown 文本内容
}
```
