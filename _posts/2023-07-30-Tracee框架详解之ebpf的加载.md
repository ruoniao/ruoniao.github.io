---
layout    : post
title     : "Tracee框架详解之ebpf的加载"
date      : 2023-01-25
lastupdate: 2023-02-11
categories: ebpf trace
---

# libbpf的Demo

先了解一个简单的golang 使用libbpf 的demo

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
 *                      |
 *                      |
 *                      |
 *                      |
 *                      |
 *                      +----> module.GetMap(name) --------> m.Resize(size)
 *                      |
 *                      |
 *                      |
 *                      |
 *                      |
 *                      +----> bpfModule.BPFLoadObject() ---> bpfModule.GetProgram("tracepoint_openat") ---> prog.AttachTracepoint("syscalls", "sys_enter_openat")---> bpfModule.InitRingBuf("events", eventsChannel) ---> pb.Start()
 *                      |
 *                      |
 *                      |
 *                      |
 *                      |
 *                      |
 *                      |
 *                      |
 *                      |
 *                      |
 *                      |
 *                      |
 *                      |
 *                      |
 *                      |
 *                      +--> bpfModule.Close()
 */
```

