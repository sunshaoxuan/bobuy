# PLAN-62 本地 Docker 单套测试资源清理

## 目标与授权
- 用户要求清理本机 Docker Desktop 中无用的 BoBuy 镜像，仅保留一套本地测试环境。
- 保留既有 bobuy-local Compose 组和全部业务数据；生产发布镜像在本机的过期副本及明确无引用的旧测试资源列为候选。
- 不操作远端生产，不修改其他项目，不删除业务卷，不执行全局 prune，不强制删除仍被保留容器引用的镜像。

## 方法与范围
1. 主 Agent 读取本地 Compose 配置，核对 Docker context、Compose 组、全部容器引用及 BoBuy 镜像标签。
2. 记录当前本地测试组需要的精确镜像 ID、数据卷及其他项目保护快照。按精确引用生成清理列表，删除前重新核对。
3. 只清理可证实无用的本项目资源。运行所需各服务可以有多个镜像，共同组成唯一测试环境。
4. 检查保留环境健康、HTTP 行为和其他项目状态。将实测数量、回收空间、保留项和未完成项记录到本文件并提交。

## 完成标准
- 本机仅保留一个 BoBuy 本地测试 Compose 组，当前服务所需镜像均存在。
- 旧 BoBuy 发布标签、旧测试标签与可证实归属本项目的无引用镜像清理完毕。
- 本地测试 HTTP 可用，既有数据卷保持，其他项目镜像与容器配置和运行状态不变。
- 记录清理前后清单、精确删除结果与风险；不可证实归属的资源保留并说明。

## 状态
- 已执行并验收。此任务属于有明确边界的本地运维清理，由主 Agent 直接执行，无外部模型调用。

## 实测结果与复核
- PASS：Docker context 为 desktop-linux。初始仅有 bobuy-local 一个本项目 Compose 组，运行 6 个服务；32 个 BoBuy 命名镜像中，30 个是无任何容器引用的发布镜像与旧基础镜像。
- PASS：删除前再次检查精确标签的镜像 ID 未变、无容器引用、无计划外标签共享；使用 image rm --no-prune 精确删除 30 个标签，无 force、无全局 prune。删除结果见 ../reports/evidence/PLAN62/deleted.json。
- PASS：只保留 bobuy/local-web:current、bobuy/local-backend:current 两个应用镜像，以及当前测试组使用的 postgres:16-alpine、redis:7-alpine、rabbitmq:3.13-management-alpine、axllent/mailpit:v1.27。
- PASS：全机 39 个容器 ID、配置哈希、运行状态、启动时间、重启次数一致，48 个数据卷清单一致；其他项目镜像引用一致。4 个无标签镜像具有 rhospital 项目标签，明确保留。未连接或操作远端生产。
- PASS：本地用户 17、行程 1、商品 8、订单 14、商客关系 13，清理前后计数一致。首页、公开行程、公开商品返回 200，匿名用户管理返回 401。公开商品的 7 个 ID 与数据库 PUBLIC 状态精确一致。
- PASS：Docker Images 统计由 77 个 / 34.37GB 变为 47 个 / 28.65GB；此为 Docker 镜像统计变化，Windows VHD 物理回收未测量。共享构建缓存未清理。
- 检查修正：Node 子进程无法发现 Compose 子命令，采用 PowerShell 中实际可用的 Docker CLI 生成 Compose 清单；公开接口按 PUBLIC 商品集合检查，避免将全部商品数误作公开商品数；Fetch 数组跨执行域，使用排序后的 JSON 值比较排除原型差异。未改变业务规则或放宽资源保护条件。
- PASS：需求文件 PROD-05 补充镜像留存和发布副本清理约束。本次无产品代码、配置或 UI 变更，无新增临时文件；验证采用真实 Docker 状态、只读 SQL、HTTP 及文档静态检查。
- 证据：../reports/evidence/PLAN62/before.json、deleted.json、after.json、compose-after.json。无本次目标未完成项；物理 VHD 压缩、共享构建缓存和其他项目清理属于非目标。
