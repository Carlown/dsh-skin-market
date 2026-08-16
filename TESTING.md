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
5. 点击「停用」，确认恢复 DSH 默认外观，但详情仍显示「已安装」。
6. 再次使用后切换到另一个皮肤，确认前一个皮肤自动停用。
7. 卸载正在使用的皮肤，确认先恢复默认外观再删除 package。
8. 制造断网后重试安装，确认错误可见且 profile `package.json` 不残留幽灵依赖。

## 4. 回滚

```bash
dsh plugin --profile web remove dsh-skin-market
```

如果市场内安装过皮肤，先在市场中逐个卸载；市场自身不会提供删除自己的按钮。
