# Local pod resource metrics

From the parent repo:

```sh
bin/kubernetes metrics
```

This installs the official Kubernetes Metrics Server Helm chart, pinned in
`config.json`, into `et-full-system-infra`. Kubernetes context defaults to
`orbstack`; use `--context` for another cluster. Installation is separate from
application deployments. Do not install a duplicate if a cluster already has
Metrics Server or another provider for `metrics.k8s.io`.

Once ready, k9s can display pod/container CPU and memory usage and percentages
relative to configured requests and limits. It may need a refresh or reconnect
if it was opened before the metrics API was installed. Metrics may take a few
scrapes to appear. Command-line checks:

```sh
kubectl --context orbstack top pods -n et-full-system
kubectl --context orbstack top pods -n et-full-system --containers
kubectl --context orbstack top nodes
```

Metrics Server provides current resource usage, not historical monitoring.
Container memory limits and OOM restarts are enforced independently by the node.
Application autoscaling remains disabled in the local profiles.

Supply cluster-specific settings with
`bin/kubernetes metrics --metrics-values /path/to/values.yaml`.
The official chart's defaults are used for kubelet connectivity; no
OrbStack-specific resources or certificate-verification overrides are configured.

Chart: https://kubernetes-sigs.github.io/metrics-server/
