---
clayout    : post
title     : "从源码到实战：rdma-core + Soft-RoCE 搭建真实 RDMA 文件传输"
date      : 2026-02-13
lastupdate: 2026-02-13
categories: network,rdma
---
----

* TOC
{:toc}

----

# 前言：把 RDMA 当成工程来学

RDMA 不是单个 API，而是一套需要“控制面 + 数据面 + 设备层”协作的工程体系。很多人卡在入门阶段，不是因为概念太难，而是因为缺少一个能跑通、可拆解、可调试的最小工程。

这篇文章以一个真实可运行的项目为主线：

- 控制面使用 `librdmacm` 建立连接、交换元信息。
- 数据面使用 `libibverbs` 执行 RDMA Write。
- 设备层使用 Soft-RoCE（RXE）在普通网卡上模拟 RDMA。

目标是完成一个**真实 RDMA 文件传输 demo**：发送端把文件内容通过 RDMA Write 写入接收端内存，接收端再落盘保存。整个流程强调“分层清晰 + 资源可回收 + 错误可定位”。

# RDMA 的核心模型：控制面与数据面分离

理解 RDMA 的关键在于分层：

1. **控制面（Control Plane）**：连接管理、元信息交换。
2. **数据面（Data Plane）**：实际数据传输。

在本工程里，控制面负责交换 HELLO/MR/FIN/ACK 控制消息；数据面负责 RDMA Write。这样可以避免控制信息和数据混杂，降低调试难度。

## 核心对象速览

- **PD（Protection Domain）**：资源所属的安全域。
- **MR（Memory Region）**：注册内存，生成 `lkey/rkey`。
- **QP（Queue Pair）**：通信端点。
- **CQ（Completion Queue）**：完成回执队列。
- **Send/Recv**：双边操作，需要先 `post_recv`。
- **RDMA Write**：单边操作，依赖对端 MR 的地址和 rkey。

这些对象是 verbs API 的核心语义，对应到 libibverbs 的常用调用。citeturn0search4turn0search5

# 控制面流程：RDMA CM 的“连接脚手架”

RDMA CM 负责连接管理，流程类似 socket，但需要显式的地址解析与路由解析：

- Client：`rdma_resolve_addr` → `rdma_resolve_route` → `rdma_connect`
- Server：`rdma_bind_addr` → `rdma_listen` → `rdma_accept`

这一流程可以在 `rdma_cm(7)` 文档中直接验证。citeturn0search3

# Soft-RoCE：没有硬件也能跑 RDMA

Soft-RoCE（RXE）是 RoCE 的软件实现，允许普通网卡以 RDMA 方式工作。核心步骤是加载 `rdma_rxe` 模块，并使用 `rdma link add` 创建 RDMA 设备。官方文档明确说明应优先使用 `rdma link`，而 `rxe_cfg` 已经被标记为 deprecated。citeturn0search6turn0search2turn0search7

在一些系统文档中，也可以看到 Soft-RoCE 的完整配置流程与注意事项。citeturn0search0

# 工程结构：让每个模块职责清晰

本工程的结构是典型的“控制面 + 数据面 + 脚本支持”布局：

- `include/rdma_sim.h`：控制消息定义 + verbs 封装声明
- `src/rdma_sim.c`：CM 事件处理 + verbs 封装实现
- `src/sender.c`：发送端逻辑
- `src/receiver.c`：接收端逻辑
- `build.sh` / `run_sender.sh` / `run_receiver.sh`：构建与运行脚本
- `setup_rxe.sh`：Soft-RoCE 启用脚本

这种划分能保证扩展性：后续如果你想加 RDMA Read、多 QP、多连接，只需要扩展对应模块即可。

# 控制面协议设计：HELLO / MR / FIN / ACK

为了让 RDMA Write 能正确执行，需要一套控制消息协议：

1. **HELLO**：发送端告知文件名与文件大小。
2. **MR**：接收端注册 MR 后回传 addr/rkey/length。
3. **FIN**：发送端通知写入完成。
4. **ACK**：接收端落盘后确认完成。

这个设计的核心是：**控制面只做必须的协商与通知，数据面只做高效写入**。

# 关键实现：从文件到 RDMA Write

发送端的核心流程：

1. 读文件到内存
2. 建立 RDMA CM 连接
3. 创建 QP/CQ/PD
4. 注册 MR
5. 发送 HELLO 并接收 MR 信息
6. 分块 RDMA Write
7. 发送 FIN，等待 ACK
8. 清理资源

接收端的核心流程：

1. 监听并接受连接
2. `post_recv` 等待 HELLO
3. 注册文件 MR，并启用 `IBV_ACCESS_REMOTE_WRITE`
4. 发送 MR 信息
5. 等 FIN → 落盘 → 回 ACK
6. 清理资源

其中，“先 post_recv 再 send”是 Send/Recv 的硬性规则。citeturn0search5

# CQ 轮询与事件驱动：为什么 demo 用 polling

`ibv_poll_cq` 的轮询模式虽然占 CPU，但在学习阶段有两个明显优势：

- 逻辑简单，便于理解 verbs 的节奏。
- 能快速定位“完成回执是否到达”的问题。

生产环境中可以改为 completion channel 或 eventfd 事件驱动，但在初学阶段，先把 polling 跑通更重要。

# 分块写入：RDMA_CHUNK 的工程意义

单次 WR 过大会导致资源不足或吞吐波动，因此采用固定块大小分片写入：

- 降低 WR 资源压力
- 便于控制发送节奏
- 为后续扩展重试机制打基础

# 运行方式（简版流程）

1. 依赖安装：`rdma-core`、`libibverbs-dev`、`librdmacm-dev`、`gcc`、`make`
2. 启用 Soft-RoCE：`./setup_rxe.sh <netdev>`
3. 构建：`./build.sh`
4. 运行：先接收端再发送端

# 12 篇资料评分与筛选

评分标准（每项 0-5，总分 25）：

- 知识体系完整性
- 准确性与权威性
- 深度与可操作性
- 最佳实践与行业一致性
- 结构清晰度

候选资料（12 篇）：

1. rdma-core 官方仓库 — 23
2. rdma_cm(7) man page — 24
3. NVIDIA RDMA CM ID Operations — 22
4. ibv_post_send man page — 22
5. ibv_post_recv man page — 22
6. Soft-RoCE 官方文档（Red Hat） — 21
7. NFS over SoftRoCE 说明 — 18
8. rxe_cfg man page（deprecated 说明） — 16
9. rping man page（示例程序） — 17
10. rdma_client man page（示例程序） — 16
11. rdma_xclient man page（示例程序） — 15
12. rdma-tutorial 开源项目 — 19

来源依据：citeturn0search1turn0search3turn0search0turn0search4turn0search5turn0search6turn0search7turn0search2turn1search0turn1search1turn1search2turn1search3

## 最终 Top 7

1. rdma-core 官方仓库（基础权威）citeturn0search1
2. rdma_cm(7) man page（控制面流程）citeturn0search3
3. NVIDIA RDMA CM ID Operations（API 细节）citeturn0search0
4. ibv_post_send man page（Send 语义）citeturn0search4
5. ibv_post_recv man page（Recv 语义）citeturn0search5
6. Soft-RoCE 官方文档（软件 RDMA 说明）citeturn0search6
7. rdma-tutorial 开源项目（实践参考）citeturn1search3

# 结语：小而完整的工程价值

如果你能在这个 demo 里解释每一条控制消息、每一次 CQ 完成、每一个 rkey 的来源，就已经掌握了 RDMA 的核心能力。后续无论是多 QP、并行连接，还是复杂协议设计，都只是规模扩展。
# 深入理解：控制面与数据面如何协作

在这个 demo 中，控制面与数据面的协作不是并行的，而是“交替推进”的：先用控制面完成连接与 MR 交换，再进入数据面执行 RDMA Write，最后回到控制面发送 FIN/ACK。这个节奏很重要，它决定了你调试时应该优先观察哪一层。

一个常见误区是：写入失败时只盯着 RDMA Write。实际上很多错误都来自控制面，比如 MR 没交换成功、连接未稳定、或者 recv 没提前投递。把控制面跑通，数据面才能稳定。

# 控制面消息的工程意义

HELLO / MR / FIN / ACK 这四类消息不是“为了演示而演示”，而是最小协议集合：

- HELLO 解决“接收端要分配多大内存”的问题。
- MR 解决“写入目标在哪里、权限是否允许”的问题。
- FIN 解决“写入已经结束”的问题。
- ACK 解决“接收端已经落盘完成”的问题。

它们对应的是一个真实工程必须要处理的四类状态：准备、授权、完成通知、最终确认。

# 内存注册与权限：为什么 rkey 是关键

MR 的注册过程把一段内存变成可被 RDMA 访问的区域。最关键的两点是：

1. rkey 本质上是远端访问凭证，没有 rkey 的 RDMA Write 等于无效。
2. MR 权限决定远端可执行的操作，如果没有 `IBV_ACCESS_REMOTE_WRITE`，即使拿到了 rkey 也无法写入。

这也是 RDMA 与传统 socket 最大的差异：**内存必须显式开放**，而不是默认可写。

# CQ 完成与 wr_id 的管理

RDMA 的每次操作最终都会映射成一个 Work Request（WR），完成后产生 Work Completion（WC）。最稳妥的做法是给每个 WR 设置唯一的 wr_id，并在 CQ 里通过 wr_id 判断完成事件的来源。这一点在多 QP 或多并发时尤为重要。

在 demo 里我们只做了单连接，wr_id 的管理相对简单，但你要知道：真正的工程往往需要一个全局 wr_id 分配器，否则排查 bug 会非常困难。

# 分块写入与吞吐稳定性

很多人第一次尝试 RDMA Write 时，倾向于“单次写完整文件”。这在小文件时可行，但在大文件场景里会遇到 QP/CQ 资源瓶颈。分块写入带来三个好处：

1. 每个 WR 的大小可控，避免资源不足。
2. 更容易实现流控和重试机制。
3. 为未来扩展多线程或多 QP 打下基础。

分块策略的本质，是把“极端的大写”变成“可控的小写”。

# 轮询模式的价值：先正确，再高性能

轮询 CQ 的好处是直观，缺点是 CPU 占用高。但在学习阶段，它能提供最重要的价值：

- 每一次 send/recv/write 都有明确的完成回执。
- 调试时能够快速定位是哪一步卡住了。

因此，demo 阶段使用 polling 并不丢人，反而是最稳妥的入门方式。

# 典型错误路径与定位方法

1. **连接建立失败**：先检查 RDMA CM 的事件是否完整（ADDR_RESOLVED、ROUTE_RESOLVED、ESTABLISHED）。
2. **Send 失败**：检查接收端是否提前 post_recv。
3. **Write 失败**：检查 MR 权限与 rkey 是否正确。
4. **落盘失败**：确认输出目录权限。
5. **程序卡死**：检查 CQ 是否没有收到完成回执，或事件通道是否未被 ack。

错误定位的顺序应该是：控制面 → CQ 完成 → 数据一致性。

# 性能与正确性的平衡

在真实项目中，你必须在正确性和性能之间做权衡。建议的路线是：

1. 先跑通正确性路径（小文件、单连接、轮询）。
2. 再引入性能优化（多连接、多 QP、事件驱动、批量 WR）。
3. 最后再加入工程化策略（监控、重试、超时、异常恢复）。

这种路径能避免“尚未理解就优化”的问题。

# 从 demo 到生产的扩展方向

如果你想把这个 demo 变成可复用的工程，可以沿着以下方向扩展：

1. **多文件并发**：一个连接传多个文件，或多个连接并行传输。
2. **多 QP 多 CQ**：提升吞吐，但需要更复杂的 wr_id 管理。
3. **数据校验**：落盘前后对比 hash，避免 silent corruption。
4. **协议扩展**：加入版本号、扩展字段、错误码等。
5. **性能统计**：记录每次 RDMA Write 的耗时与带宽。

这些方向都建立在“控制面清晰、数据面稳定”的前提下。

# Soft-RoCE 的现实边界

Soft-RoCE 是学习 RDMA 的好工具，但它并不等价于真实硬件 RNIC：

- 性能受内核与 CPU 影响更大。
- 高并发场景下容易暴露资源瓶颈。
- 适合学习与验证，不适合高压生产。

因此，你可以用它练习 RDMA 思维，但在性能敏感系统中仍需要硬件支持。

# 一个完整时序的复盘（文字版）

1. 发送端解析地址、路由并建立连接。
2. 接收端监听并接受连接。
3. 接收端 post_recv 等待 HELLO。
4. 发送端发送 HELLO。
5. 接收端分配缓冲区并注册 MR，发送 MR 信息。
6. 发送端分块 RDMA Write。
7. 发送端发送 FIN，接收端落盘并回 ACK。
8. 双方断开连接并释放资源。

当这个流程稳定后，你就能在此基础上叠加更多复杂功能。

# 小结：为什么这个 demo 值得做

RDMA 学习的最大痛点不是概念，而是缺乏可验证的工程路径。这个 demo 的价值在于：它是小而完整的工程，既能跑通，又能拆解。只要你能把每一步讲清楚，你就已经具备了构建复杂 RDMA 系统的能力。# 资源生命周期：从创建到销毁的全链路

RDMA 的资源管理比 socket 更严格，因为资源分布在用户态与内核态之间。一个完整的生命周期大致如下：

1. **事件通道（event channel）**：负责接收 CM 事件。
2. **CM ID**：连接的核心对象。
3. **PD/CQ/QP**：通信相关资源。
4. **MR**：注册的内存区域。

销毁顺序也很重要，通常建议按“反向顺序”释放：

- 先断开连接（rdma_disconnect）
- 再销毁 QP（rdma_destroy_qp）
- 再销毁 CM ID（rdma_destroy_id）
- 最后释放内存、销毁事件通道

这条路径的价值是：无论成功还是失败，都有统一的退出路径，避免资源泄漏。

# 调试方法：从“观测点”定位问题

RDMA 调试不是盲目加日志，而是要在关键观测点上记录状态：

1. **CM 事件观测**：记录每个事件是否按预期出现。
2. **CQ 完成观测**：记录每个 WR 的完成状态。
3. **数据一致性观测**：写入前后对比内容 hash。

一旦出问题，优先判断是哪一层失效：如果 CM 事件不完整，说明控制面未建立；如果 CQ 没完成，说明 WR 未真正执行；如果 CQ 完成但数据不一致，说明可能有权限或地址错误。

# 常见问题与经验总结

1. **连接建立成功但写入失败**：通常是 MR 权限不够或 rkey 错误。
2. **写入成功但接收端落盘失败**：通常是输出目录权限问题。
3. **程序偶发卡死**：可能是 CQ 没收到完成事件，或事件未 ack。
4. **多次运行后出错**：很可能是资源未释放干净，导致内核状态异常。

这些问题在 Soft-RoCE 环境中更容易出现，因此更需要严格的退出路径。

# 数据一致性与文件完整性

RDMA 的高性能让人容易忽略“数据是否正确”。建议在 demo 阶段就加入完整性验证：

- 发送端在写入前计算 hash。
- 接收端落盘后再计算 hash。
- 两端对比结果，确保一致。

这一步虽然额外消耗一些时间，但能帮你快速排除“写入成功但内容损坏”的隐性问题。

# 进一步学习的路线图

如果你想系统掌握 RDMA，可以按照以下路线走：

1. **理解控制面与数据面**：确保能独立实现连接建立与 RDMA Write。
2. **掌握多 QP 与多 CQ**：体验并发与吞吐变化。
3. **引入 RDMA Read**：理解单边读写的差异。
4. **阅读 rdma-core 示例工具**：理解标准实现方式。
5. **进入真实项目**：例如存储系统或高性能消息队列。

这条路径能保证你从“能跑通”走向“能设计”。

# 为什么要强调“可解释性”

最有价值的 RDMA demo 不是性能最高的，而是你能完全解释的。只要你能回答以下问题，你就具备了扎实的 RDMA 基础：

1. HELLO 为什么要带文件大小？
2. MR 信息为什么必须回传？
3. RDMA Write 为什么不触发 recv？
4. FIN/ACK 为什么必不可少？
5. CQ 完成为什么必须检查状态？

当你能解释这些问题，就能在更复杂的系统中保持清晰的工程判断。# 设计权衡：为什么选择最小协议而不是复杂框架

在真实系统中，你可能需要复杂的元数据协议、版本协商、加密认证等。但在入门阶段，最重要的是让协议最小化、可验证。我们选择 HELLO/MR/FIN/ACK 就是为了把“必须存在的协议要素”完整跑通，而不是陷入复杂性泥潭。

当你把这四类消息跑通，你就能自然理解复杂协议为什么存在：它们不过是这些基础元素的扩展。

# 可靠性策略：如何避免“写完但不确认”

RDMA Write 的单边特性决定了发送端永远无法直接感知接收端的状态。FIN/ACK 在这里起到“应用层确认”的作用：

- FIN 表示发送端写入结束。
- ACK 表示接收端完成落盘。

这种设计是很多 RDMA 存储系统的雏形：数据路径快，但控制路径必须可靠。

# 性能调优的基本思路

当你要提升性能时，可以从以下几个维度入手：

1. **减少 CQ 轮询成本**：使用事件驱动。
2. **批量 WR 提交**：减少系统调用开销。
3. **多 QP 并发**：提高吞吐。
4. **大页内存注册**：减少 TLB 压力。

但这些优化只有在正确性稳定后才有意义，否则只会放大 bug。

# Soft-RoCE 与真实 RNIC 的差异

Soft-RoCE 的价值是“功能正确性”，而不是极致性能。真实 RNIC 能把数据路径卸载到硬件，因此延迟和吞吐会显著提升。你可以把 Soft-RoCE 看成“RDMA 行为模拟器”，它帮助你理解协议与编程模型，但不代表最终性能上限。

# 本地与双机实验建议

如果你只有一台机器，可以用不同端口模拟发送端与接收端；但双机实验仍然更接近真实环境。双机实验能暴露更多网络问题，比如 MTU、路由、端口占用、网络隔离等。建议你在条件允许时尽量用双机验证。

# 总结一句话

这个 demo 的意义不是“跑出最快速度”，而是让你清楚知道每一层在做什么。只要你能解释每个步骤，就能在未来复杂项目中保持工程自信。# 实践清单（建议逐条验证）

为了保证工程质量，建议你在每次修改后做以下验证：

1. 使用小文件与大文件分别测试，确保分块逻辑正确。
2. 测试多次连续运行，确认资源释放干净。
3. 模拟异常中断（发送端中途退出），观察接收端是否能正常回收。
4. 检查日志输出，确保控制面事件顺序完整。
5. 在不同 MTU 环境下测试，避免隐藏的网络问题。

这一套清单能快速提高稳定性，并为后续性能优化提供可靠基线。# 你下一步可以做什么

如果你已经跑通了这个 demo，可以尝试把控制面和数据面拆成独立模块，或者把 RDMA Write 替换为 RDMA Read。每做一步，都记录新的协议需求与资源变化，这样你会更快掌握 RDMA 设计思维。# 小结再强调一次

RDMA 的学习成本高，但只要有一个完整的最小工程，你就能通过不断改造它来掌握更复杂的系统。把这个 demo 当作你的“RDMA 基础实验台”，每次改动都能积累真实经验。# 再补一句实践经验

当你遇到难以解释的异常时，先把流程缩小到最小文件与最小步骤，往往能迅速定位问题来源。# 最后一段补充

如果要把这个 demo 交给团队使用，建议补充运行脚本与日志规范，让调试信息更可读。# 补充一句结论

稳定性与可解释性永远是 RDMA 入门的第一优先级。# 极简补充

请保持日志清晰可读。# 再补两字

完结。
# 参考资料

```text
https://github.com/linux-rdma/rdma-core
https://man7.org/linux/man-pages/man7/rdma_cm.7.html
https://docs.nvidia.com/networking/display/RDMAAwareProgrammingv17/Connection%2BManager%2B%28CM%29%2BID%2BOperations
https://man7.org/linux/man-pages/man3/ibv_post_send.3.html
https://man7.org/linux/man-pages/man3/ibv_post_recv.3.html
https://docs.redhat.com/en/documentation/red_hat_enterprise_linux/7/html/networking_guide/sec-configuring_soft-_roce
https://linux-nfs.org/wiki/index.php/NFS_over_SoftRoCE_setup
https://manpages.debian.org/testing/rdma-core/rxe_cfg.8.en.html
https://manpages.debian.org/unstable/rdmacm-utils/rping.1.en.html
https://www.man7.org/linux/man-pages/man1/rdma_client.1.html
https://manpages.debian.org/testing/rdmacm-utils/rdma_xclient.1
https://github.com/rhiswell/rdma-tutorial
```