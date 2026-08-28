# Password Keeper

一个基于 **Vue 3** 的在线密码保险库。以文件管理器的形式管理信息，数据经 **AES 加密 + gzip 压缩** 后同步到远端，所有内容仅在本地加密，保障隐私安全。

支持：
- 储存密码和文本笔记，对应后缀分别为 `.pwd` 和 `.md`。
- 可以使用文件夹来组织这些文件。
- 支持文件的增加、删除、修改、移动。
- 允许在线修改 `.pwd` 和 `.md` 文件。
- 远端保存，多处同步。
- 使用 SHA-512 进行端到端加密，保证您的隐私。
- 支持导出

若您想要从 [Password Helper](https://github.com/jerry-sourcecode/Password-Helper) 迁移到此项目，可以使用根目录下的 [migrate.py](./migrate.py)，这是一个自带GUI的小程序，可以帮助您进行 umc 文件的升级。