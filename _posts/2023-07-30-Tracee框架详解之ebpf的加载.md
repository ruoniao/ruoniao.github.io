---
layout    : post
title     : "Tracee框架详解之ebpf的加载"
date      : 2023-01-25
lastupdate: 2023-02-11
categories: ebpf traceza
---

# libbpf的Demo

---

最近再了解linux tracee的一些相关知识，了解到Tracee是以色列的一家安全公司AquaSecurity开源的linux监控软件，是一个轻量级的基于eBPF的事件跟踪程序。

----

* TOC
{:toc}

----
# 1 概念及关系
## 1.1 ebpf概述

## 1.2 libbpf概述

## 1.3 libbpfgo概述

## 1.4 简单运用

先了解一个简单的golang 使用

```golang
import (
        "bytes"
        "encoding/binary"
        "fmt"
        "log"

        bpf "github.com/aquasecurity/libbpfgo"
)

type gdata struct {
        Pid      uint32
        FileName string
}

func resizeMap(module *bpf.Module, name string, size uint32) error {
        m, err := module.GetMap(name)
        if err != nil {
                return err
        }

        if err = m.Resize(size); err != nil {
                return err
        }

        if actual := m.GetMaxEntries(); actual != size {
                return fmt.Errorf("map resize failed, expected %v, actual %v", size, actual)
        }

        return nil
}

func main() {
        bpfModule, err := bpf.NewModuleFromFile("main.bpf.o")
        if err != nil {
                panic(err)
        }
        defer bpfModule.Close()
        if err := resizeMap(bpfModule, "events", 8192); err != nil {
                panic(err)
        }

        if err := bpfModule.BPFLoadObject(); err != nil {
                panic(err)
        }
        prog, err := bpfModule.GetProgram("tracepoint_openat")
        if err != nil {
                panic(err)
        }
        if _, err := prog.AttachTracepoint("syscalls", "sys_enter_openat"); err != nil {
                panic(err)
        }

        eventsChannel := make(chan []byte)
        pb, err := bpfModule.InitRingBuf("events", eventsChannel)
        if err != nil {
                panic(err)
        }

        pb.Start()
        defer func() {
                pb.Stop()
                pb.Close()
        }()

        for {
                select {
                case e := <-eventsChannel:
                        pid := binary.LittleEndian.Uint32(e[0:4])
                        fileName := string(bytes.TrimRight(e[4:], "\x00"))
                        gd := gdata{
                                Pid:      pid,
                                FileName: fileName,
                        }
                        log.Printf("pid %d opened %q", gd.Pid, gd.FileName)
                }
        }
}
```

```shell
/*
 * bpfModule, err := bpf.NewModuleFromFile("main.bpf.o")
 *      |
 *      |
 *      |
 *      |
 *      |
 *      +----> module.GetMap(name) --------> m.Resize(size)
 *      |
 *      |
 *      |
 *      |
 *      |
 *      +----> bpfModule.BPFLoadObject() ---> bpfModule.GetProgram("tracepoint_openat") ---> prog.AttachTracepoint("syscalls", "sys_enter_openat")---> bpfModule.InitRingBuf("events", eventsChannel) ---> pb.Start()
 *      |
 *      |
 *      |
 *      |
 *      |
 *      |
 *      |
 *      |
 *      |
 *      |
 *      |
 *      |
 *      |
 *      |
 *      |
 *      +--> bpfModule.Close()
 */
```

