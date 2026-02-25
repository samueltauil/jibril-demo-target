/*
 * payload.c — Minimal demo binary used by attack scenarios.
 * Compiled at Docker build time to /usr/local/bin/demo-payload.
 * Benign: prints a message and exits. Renamed/symlinked to suspicious
 * names (xmrig, payload, exploit) by scenarios to trigger Jibril detections.
 */
#include <stdio.h>
#include <unistd.h>

int main(int argc, char *argv[]) {
    printf("[demo-payload] running as PID %d", getpid());
    if (argc > 1) {
        printf(" with args:");
        for (int i = 1; i < argc; i++) {
            printf(" %s", argv[i]);
        }
    }
    printf("\n");
    fflush(stdout);
    /* Brief sleep so eBPF has time to observe the process */
    usleep(500000);
    return 0;
}
