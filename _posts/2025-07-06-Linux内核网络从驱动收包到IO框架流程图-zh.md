---
layout    : post
title     : "Linux内核网络从驱动收包到IO框架流程"
date      : 2025-07-06
lastupdate: 2025-07-06
categories: kernel 
published: true
---

最近梳理了下linux 从收包到用户态poll的流程图，记录在此[pdf](https://ruoniao.github.io/assets/img/driver2poll.pdf)中，从可以了精确的了解到：

- 为什么tcpdump抓取不到xdp的数据包。
- 为什么poo/epoll本质上不是异步IO，本质在哪里。
