# Local Kubernetes, one service at a time

Each service owns its Helm chart and local Kubernetes profile. The parent repo
owns the common runner and shared infrastructure. Running one service never
installs the others unless `up --all` is selected. ET1, API, ET3 and admin are configured, using their existing startup scripts
with production Rails settings and shared PostgreSQL. API also uses shared
Azurite and a separate GoodJob worker.

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

## Eco mode and production mode

By default, `up` and `render` use eco mode: one replica per application
deployment, including the API queue worker. This applies to every selected
service and leaves the checked-in chart values unchanged.

Use `--production` for a closer representation of production. Currently, this
means inheriting the replica counts from the charts and local values instead of
overriding every deployment to one replica:

```sh
bin/kubernetes up --all --production
bin/kubernetes render --service api --production
```

Run `up` again without the switch to return the selected services to one replica.
Both modes already inherit resource requests and limits from the application
charts. `--production` still deploys to the selected local context (`orbstack`
by default), using local URLs, credentials and support services. It does not
select a production cluster, enable autoscaling, or change shared infrastructure.
Rails runs with `RAILS_ENV=production` in both modes.

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

`up --all` brings up the full setup in this order, waiting for each stage:

1. Shared ingress, PostgreSQL, Azurite (including blob container initialization),
   fake services/mail and Metrics Server.
2. API, whose web startup creates and migrates its databases.
3. ET1, then ET3, each preparing its own database during startup.
4. Admin, which reads all three applications' databases.

This works after `down -v` and also upgrades an existing setup. A failed stage
stops the command before starting later stages; the console identifies each
stage. It uses the configured application readiness probes and rollout checks,
not an end-to-end workflow test. API web and worker still start within the same
Helm release; the documented first-start worker race is unchanged.

With `--build`, both the fake-services image and all application images are
built. Without it, those local images must already be available. `--production`
uses chart replica counts for every application as described above.
`--ingress-values`, `--postgres-values`, `--azurite-values`, `--support-values`
and `--metrics-values` also work with `up --all`, as do the context, domain and
ingress port options.

Repeat `--service` to select a subset. A single service or an explicitly selected
subset does not install shared infrastructure or other applications; prepare
its dependencies first. Other commands with `--all` select all configured
applications. The parent requires an explicit selection.

## Configuration ownership

Each configured child repo contains `kubernetes/service.json`,
`kubernetes/values.local.yaml`, and optional `kubernetes/templates/` overrides.
The runner resolves chart dependencies in a temporary directory. It does not
modify the checked-out application chart or `Chart.lock`. ET1's local helper
overrides the AKS topology rules hardcoded in base 1.4.1.

Commit service configuration in the child repo and shared infrastructure/runner
changes in this parent repo. See [the API instructions](../systems/api/kubernetes/README.md) for its deployment
and the first-start worker migration race. ET1 connects directly to the internal API Service. ACAS, CCD, Notify and mail
use the shared local support services below.

## Shared Azurite

From the parent, run `bin/kubernetes azurite`. This installs the blob emulator
with a retained 5Gi PVC into `et-full-system-infra`, waits for readiness and
creates `et-api-test-container` and `et-api-direct-test-container` if absent.
Initialization is safe to repeat. The internal endpoint is
`http://azurite.et-full-system-infra.svc.cluster.local:10000`; no ingress is needed
for the current application proxy routes. Credentials are the standard public
Azurite development account and key, not Azure production credentials.

Use `--azurite-values /path/to/values.yaml` to override the image, account,
containers or storage settings; keep API storage values consistent. The PVC
`data-azurite-0` retains blobs across pod restarts and Helm removal.

## Shared fake services and mail

From the parent checkout:

```sh
bin/kubernetes support --build
```

This builds `support/fake_services/Dockerfile` and installs the existing
Foreman processes (fake ACAS, CCD and Notify) in one pod, matching Compose.
Mailpit runs in a separate pod. If the image is already available, omit
`--build`. Application deployment remains separate. The default Kubernetes and
Docker contexts are `orbstack`; override them independently as for applications.

All support Services live in `et-full-system-infra`. API and ET1 use internal
DNS names, including that namespace. Fake Notify sends SMTP mail to `mailpit`
in its own namespace. Fake ACAS and CCD use their bundled test credentials.
No application source or production chart values are changed.

Browser access through the shared ingress:

- Mailpit: <https://mail.k8s.orb.local/>
- Fake CCD: <https://et-ccd.k8s.orb.local/ui/>
- Fake ACAS: <https://acas.k8s.orb.local/>
- Fake Notify: <https://notify.k8s.orb.local/>

These hosts expose each existing service; not every root path has a web page.
`support --domain localhost` changes the suffix; configure local DNS and TLS
as described above. With an ingress HTTPS port of 3443, include `:3443` in
browser URLs. `--support-values /path/to/values.yaml` overrides images, pull
policies and ingress class. Other clusters must have the locally built fake
services image available.

Fake CCD/Notify state and Mailpit messages are ephemeral and reset when their
pods restart, as in the existing Compose setup. PostgreSQL and Azurite retain
their own persistent data. Support pod readiness checks ports/API availability;
it does not prove that an entire claim workflow succeeds.

Mailpit is pinned to `axllent/mailpit:v1.31.3` and stores messages in a SQLite
database on a disk-backed `emptyDir`, not in an in-memory mailbox. It periodically
prunes the oldest messages to retain the latest 500. Configure the count and
resource requests/limits through `mailpit.maxMessages` and `mailpit.resources`
in `kubernetes/support/values.yaml`, or an additional `--support-values` file.
The database survives a container restart but is lost when its pod is replaced
or the release is removed; there is no mail PVC. Startup and readiness probes
check TCP ports without listing message bodies. Automatic version checks are
disabled; local SMTP accepts the applications' dummy credentials.

All Kubernetes application SMTP hosts use
`mailpit.et-full-system-infra.svc.cluster.local:1025`. The support runner passes
the existing fake Notify YAML to Helm with `--set-file`; the chart changes its
SMTP host and mounts the resulting ConfigMap. Email templates and API keys
remain shared with Compose. The existing Compose setup continues to use MailHog.
Updating the mounted Notify configuration restarts the grouped fake-services
pod, which resets fake CCD/Notify state.

The browser URL stays <https://mail.k8s.orb.local/>. Mailpit's testing API is
different from MailHog's: search uses `/api/v1/search`, and raw email is fetched
separately via `/api/v1/message/{ID}/raw`. The full-system tests must be updated
before their existing MailHog assertions can pass.

During setup, replaying a captured single-claim request returned 202; the API
worker fetched an ACAS certificate, stored files in Azurite, exported to fake
CCD and delivered the confirmation email to Mailpit.

```sh
kubectl --context orbstack -n et-full-system-infra logs deployment/fake-services --follow
kubectl --context orbstack -n et-full-system-infra logs deployment/mailpit --follow
```

## ET3 and admin

ET3 owns setup of its database, using the same startup pattern as ET1. Admin
shares the API databases and seeds its own users/permissions; it also reads the
ET1 and ET3 databases. Deploy ET3 before using admin, because admin's navigation
requires the ET3 schema. From each child directory, run `../../bin/kubernetes up`.

See [ET3 instructions](../systems/et3/kubernetes/README.md) and
[admin instructions](../systems/admin/kubernetes/README.md). Browser URLs are
<https://et3.k8s.orb.local/> and <https://admin.k8s.orb.local/>. The local seeded
admin login is `admin` / `password`. Redis is not deployed; the legacy Sidekiq
page is expected to fail, while GoodJob uses PostgreSQL.

## Resource usage in k9s

Install Metrics Server once from the parent checkout:

```sh
bin/kubernetes metrics
```

This defaults to the orbstack context and installs the pinned official chart.
k9s can then show live CPU/memory usage and percentages against requests and
limits. Reconnect k9s if it was opened before installation. See
[Metrics Server instructions](metrics-server/README.md) for other contexts,
additional values and command-line checks. OOM enforcement and restart counts
work independently of Metrics Server.

## Stop or reset the local setup

From the parent checkout:

```sh
bin/kubernetes down --dry-run   # preview without changing the cluster
bin/kubernetes down             # uninstall apps and shared infrastructure
bin/kubernetes down -v          # also delete PostgreSQL/Azurite PVCs and data
```

The default context is `orbstack`; every cluster command explicitly selects
it. Full teardown uninstalls configured app releases plus support, PostgreSQL,
Azurite, ingress and Metrics Server. It waits for removal, skips already absent
releases and leaves unrelated releases alone.

Without `-v`, the retained `data-postgres-0` and `data-azurite-0` claims are reused
on startup. `-v`/`--volumes` deletes those claims after workloads stop, destroying
their data on OrbStack's default storage class. Other storage classes may retain
backing PVs according to their reclaim policy. Namespaces, images and source
files remain. Fake CCD/Notify state and Mailpit messages are ephemeral and are
lost when those pods stop, even without `-v`, as in Compose.

To stop only one application:

```sh
bin/kubernetes down --service api
# Or from systems/api:
../../bin/kubernetes down
```

Shared infrastructure stays running for partial teardown. `down --all` selects
the full setup even from a child directory. `-v` is rejected for partial
teardown because the data is shared. Stop tests before stopping their services.

To start again from the parent:

```sh
bin/kubernetes up --all
```

Add `--build` to rebuild application and fake-services code. This order prepares all
databases before admin starts. Existing startup scripts create, migrate and
seed databases after a reset. CPU/memory values come from the application
charts and their base defaults; the runner no longer reads resource override
files or syncs from Flux.

Startup coordination checks use mocked cluster calls:
`python3 -m unittest discover -s tests -p 'test_kubernetes_up.py'`.
