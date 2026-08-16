# 安装实测

## 1. 安装前检查

在本目录执行：

```bash
npm install
npm run check
```

这一步只构建插件，不会修改任何 DSH profile。

## 2. 安装到 web profile

```bash
dsh plugin --profile web add "file:/Users/leon/Code/liang-intensity-calibrator/code/dsh-skin-market"
```

重启 `dsh web`，打开「设置 → 皮肤市场」。

## 3. 建议实测顺序

1. 确认市场弹窗只在皮肤市场页扩大，切换其他设置项恢复原尺寸。
2. 确认 Liang 与 Deep Whale 使用仓库真实截图，GitHub 地址和 Stars 可见。
3. 安装一个皮肤；安装后应显示「使用」，而不是直接显示「正在使用」。
4. 点击「使用」。若当前进程尚无新 loader entry，应显示“需要重启”；重启后应成为「正在使用」。

## 在线目录刷新

1. 打开「设置 → 皮肤市场」，确认标题区域不显示目录来源、更新时间或刷新按钮。
2. 保持市场插件版本不变，部署一个包含新 `generatedAt` 的 Pages catalog；等待后台轮询或切换窗口焦点后，新皮肤应无感出现在列表并可进入安装生命周期。
3. 自动更新时确认当前详情、已打开弹窗和列表滚动位置都不会被重置。
4. 断网后重新聚焦窗口，列表应保留最近一次缓存；删除 profile 下 `.dsh-skin-market/catalog.json` 后再断网启动，应回退插件内置目录。
5. 点击「停用」，确认恢复 DSH 默认外观，但详情仍显示「已安装」。
6. 再次使用后切换到另一个皮肤，确认前一个皮肤自动停用。
7. 卸载正在使用的皮肤，确认先恢复默认外观再删除 package。
8. 制造断网后重试安装，确认错误可见且 profile `package.json` 不残留幽灵依赖。

## 4. 回滚

页面因皮肤冲突而无法操作时，可先停止 DSH，再运行离线急救命令：

```bash
~/.dsh/profiles/web/node_modules/.bin/dsh-skin-market-reset --profile web
```

确认 profile 的顶层 bundles 不再包含市场管理的皮肤、对应注册行均为 `disabled: true`，然后重新启动 DSH。

```bash
dsh plugin --profile web remove dsh-skin-market
```

如果市场内安装过皮肤，先在市场中逐个卸载；市场自身不会提供删除自己的按钮。
