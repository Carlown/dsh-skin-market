# DSH skin crawl smoke review

复核时间：2026-08-16

这是对 `report.md` 中 8 个 `probable-skin` 的人工烟雾复核。候选仍未进入正式 registry，也没有执行安装。

## 确认为外观类候选

| 仓库 | 类型 | Package | 当前仓库版本 | 依据 | 后续缺口 |
|---|---|---|---|---|---|
| [linzhuoliSOC/dsh-skin-study](https://github.com/linzhuoliSOC/dsh-skin-study) | 3D 场景皮肤 | `dsh-skin-study` | `0.1.0` | 可安装 DSH bundle/client、预构建 lib、3D 书房和 WebGL 降级 | 核对截图、release SHA、许可文件与 DSH 兼容范围 |
| [zhijun-dai/Catppuccin-dsh-theme](https://github.com/zhijun-dai/Catppuccin-dsh-theme) | Token 主题包 | `dsh-catppuccin` | `0.1.1` | 四套 Catppuccin 主题、DSH theme runtime、可恢复 Default | 补皮肤 manifest、固定 release SHA、策展四种模式截图 |
| [ink5897/dsh-theme-kit](https://github.com/ink5897/dsh-theme-kit) | 综合皮肤包 | `dsh-theme-kit` | `0.1.0` | 32 款主题、动态/静态壁纸、纹理和桌宠 | 名称像开发工具但实际是可安装皮肤；需分拆多主题预览模型 |
| [haibala-aii/dsh-extensions-wallpaperskin](https://github.com/haibala-aii/dsh-extensions-wallpaperskin) | Wallpaper Engine 外观扩展 | `@haibala-aii/dsh-extensions-wallpaperskin` | `0.2.0` | 本地壁纸选择、透明表面、标准 bundle/client | Windows/Wallpaper Engine 限定；页面需显示平台与本地文件权限 |
| [YRN-playmaker/dsh-wallpaper_share](https://github.com/YRN-playmaker/dsh-wallpaper_share) | Wallpaper Engine 同步皮肤 | `we-sync-dsh` | `0.1.0` | 实时同步壁纸、磨砂界面、透明度与模糊控制 | Windows 限定；需要检查本机路由边界和预览授权 |
| [Tkingxiao/dsh-any-background](https://github.com/Tkingxiao/dsh-any-background) | 自定义背景皮肤 | `dsh-any-background` | `0.1.6` | 自定义颜色、壁纸、透明度、暗亮模式与预构建 lib | 核对图片持久化、Desktop 兼容例外和固定 SHA |

## 假阳性

| 仓库 | 实际类型 | 不应作为单个皮肤收录的原因 |
|---|---|---|
| [LeemanCheung/dsh-skin-studio](https://github.com/LeemanCheung/dsh-skin-studio) | 皮肤制作与审计工具 | 创建、预览、导入和导出 `.dshskin`；它本身不是一个确定视觉皮肤 |
| [MarecGents/deepseek-harness-hub](https://github.com/MarecGents/deepseek-harness-hub) | Windows WebView2 桌面壳 | 主题同步只是桌面壳众多能力之一，不是皮肤插件 |

## 烟雾结论

- `dsh.bundle + dsh.client + 外观关键词` 只能证明它是带界面的 DSH 插件，不能证明它是皮肤。
- 皮肤制作器、主题管理器、桌面壳必须有独立产品类型，不能混进皮肤列表。
- 六个确认候选还需逐仓库解析完整 commit、预览图、许可证、平台和权限，审核后才能写入 `registry/skins/`。
