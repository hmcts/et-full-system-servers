# Local Kubernetes, one service at a time

Each service owns its Helm chart and local Kubernetes profile. The parent repo
owns the common runner and shared infrastructure. Running one service never
installs the others. ET1 is currently the only configured application, running
its existing production startup script with shared PostgreSQL.

## Shared ingress

From the parent repo, install the shared controller once:

```sh
bin/kubernetes ingress --context orbstack
```

This installs the pinned Traefik chart using `kubernetes/ingress/values.yaml`
into `et-full-system-infra`, creating the non-default `et-local` IngressClass.
It uses standard Kubernetes Ingress and LoadBalancer resources, with no
OrbStack-specific CRDs. HTTP port 80 redirects to HTTPS port 443. Traefik
terminates TLS and forwards plain HTTP to each application's Service.

### Certificates and trust

On this OrbStack setup, `https://et1.k8s.orb.local/` presents a certificate issued
by **OrbStack Development Root CA**. A normal curl request passed verification
without `-k` (`ssl_verify_result=0`). OrbStack provides its own local HTTPS and
certificate integration for its domains; see its
[HTTPS documentation](https://docs.orbstack.dev/docker/https).

OrbStack's automatic HTTPS integration may display macOS certificate/trust
prompts on first use. **macOS displayed two prompts during this setup, and the
developer approved them.** A read-only inspection afterwards found **OrbStack
Development Root CA** in the user's trust settings for **SSL** and **Apple X509
Basic**, both with `TrustRoot`; no OrbStack admin-scope entry was present.
The prompts were not captured, so their exact text is not recorded.

The runner itself does not issue CA-installation or trust-changing commands,
edit keychains, or persistently disable TLS verification. Accessing the
OrbStack HTTPS URL can trigger OrbStack's automatic certificate setup and its
OS approval prompts; this is a prerequisite for locally trusted HTTPS, rather
than a step in the runner. Review those prompts as part of local setup.

During initial diagnostics, `curl -k` was used for one request; it only bypasses
verification for that invocation and is not required for the verified OrbStack
URL. The follow-up `security dump-trust-settings` checks were read-only.

On other clusters/domains, do not assume OrbStack's certificate integration is
available. Traefik falls back to a generated self-signed certificate unless a
certificate is configured. For warning-free HTTPS, provision a local certificate
covering the chosen hostname and trust its issuing CA using your environment's
normal certificate setup. Any required trust installation must be documented for
that setup; this runner will not perform it automatically. Do not disable TLS
verification globally. `--ingress-values` allows supplying environment-specific
controller/certificate settings without changing service code.

## Shared PostgreSQL

From the parent repo:

```sh
bin/kubernetes postgres --context orbstack
```

This installs the local chart in `kubernetes/postgres` into
`et-full-system-infra`. PostgreSQL 15 matches Compose and is accessible only
inside the cluster at `postgres.et-full-system-infra.svc.cluster.local:5432`.
The development username/password are `postgres` / `local-only`; applications
create their own databases. ET1 uses `etdb`.

The StatefulSet requests a 5Gi persistent volume using the cluster's default
storage class. Pod restarts retain data. Removing the Helm release also retains
its PVC (`data-postgres-0`); deleting that PVC destroys its database data.
Clusters need a dynamic storage provisioner, or an appropriate provisioned PV.
Override image, credentials, resources or storage class with an additional values
file: `bin/kubernetes postgres --postgres-values /path/to/values.yaml`.
Keep service DB configuration consistent if changing credentials or the host.
Postgres initialization credentials apply only to a new volume; changing Helm
values does not change passwords in an existing database.

## Deploy one service

```sh
cd systems/et1
../../bin/kubernetes up --context orbstack
../../bin/kubernetes status --context orbstack
../../bin/kubernetes logs --context orbstack
```

Open <https://et1.k8s.orb.local/>. No port forwarding is needed. The hostname
uses OrbStack's local wildcard DNS, not an external DNS service. The request
reaches ET1. After database setup, `/apply` renders the claim start page.
ET1 uses its existing `./run.sh` startup script. Local values set
`DOCKER_STATE=create`, so the script creates the database, runs schema/data
migrations and seeds, then starts the web and Solid Queue processes from
`Procfile`. The main application chart keeps `DOCKER_STATE=migrate` for the
existing production startup behaviour. There is no separate migration Job.

`up` waits for ET1's web readiness probe (the `/apply` page) and rollout before
reporting success. Automated tests should wait for `up` to succeed. Startup
runs the existing tasks again whenever the container restarts, matching the
application's current mechanism. Migration improvements are a separate phase.

The local HTTP-only initializer is no longer mounted: Rails keeps its existing
production SSL assumption and uses secure session cookies. ET1's application
source and shared base chart stay unchanged.

`build` builds the selected service's Dockerfile. `up --build` builds and deploys
it, restarting its deployments to pick up the rebuilt local image.

## Other clusters, domains and ports

The default Kubernetes and Docker contexts are `orbstack`; use `--context` and
`--docker-context` to override them independently. Neither current context is
changed. Every cluster command explicitly selects its requested context.

For example, on a cluster exposing the controller on localhost:

```sh
# From the parent
bin/kubernetes ingress --context docker-desktop

# From systems/et1
../../bin/kubernetes up --context docker-desktop --domain localhost
```

Then use `https://et1.localhost/`. `--domain` changes the host rules and the
application's local URL settings. It does not configure DNS or make a cluster
expose its ports; those are the responsibility of the chosen cluster. Use local
DNS or a hosts entry as appropriate, without external services such as nip.io.
Other clusters must also have the application image available on their nodes;
ET1 uses `imagePullPolicy: Never`, and changing context does not transfer images.

To keep HTTPS on 3443 instead:

```sh
# From the parent
bin/kubernetes ingress --context orbstack --https-port 3443

# From systems/et1; keep application URLs consistent with the controller
../../bin/kubernetes up --context orbstack --https-port 3443
```

Use `https://et1.k8s.orb.local:3443/`. HTTP redirects follow the selected HTTPS
port automatically. `--http-port` also configures the controller's HTTP port.
For further controller settings, edit its shared values or pass an additional
file with `bin/kubernetes ingress --ingress-values /path/to/values.yaml`.
For a different ingress controller, change the service profile's ingress class
and annotations rather than installing this shared Traefik instance.

## Select several services

From the parent:

```sh
bin/kubernetes list
bin/kubernetes up --service et1
bin/kubernetes up --build --all
```

`--all` selects services with a local profile, currently ET1 only. Repeat
`--service` to select a subset. The parent requires an explicit selection;
it never implicitly deploys everything. Shared ingress and PostgreSQL are installed separately.

## Configuration ownership

Each configured child repo contains `kubernetes/service.json`,
`kubernetes/values.local.yaml`, and optional `kubernetes/templates/` overrides.
The runner resolves chart dependencies in a temporary directory. It does not
modify the checked-out application chart or `Chart.lock`. ET1's local helper
overrides the AKS topology rules hardcoded in base 1.4.1.

Commit service configuration in the child repo and shared infrastructure/runner
changes in this parent repo. PostgreSQL is a separate shared infrastructure
step; Azurite and the other applications remain future steps. The claim start
page works, but submitting a claim still needs the API and other integrations.
