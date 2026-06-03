@echo off
chcp 65001 >nul 2>&1
title 历史闪卡 · MinerU服务
echo.
echo  正在启动历史闪卡服务...
echo  请等待浏览器自动打开...
echo.
"d:\AI Related\Claws\mineru_env\Scripts\python.exe" "d:\AI Related\Claws\flashcard_backend.py"
pause