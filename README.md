# et-full-system-servers
This repository is simply contains the 5 or 6 submodules for employment tribunals and can be cloned manually or using the 'et_full_system' command from the et-full-system-gem if you are not using the 'skaffold' method.

## Cloning Manually

If you are planning to use the 'skaffold' tool to run this (experimental at the moment), you should ideally
manage without the et_full_system command.  Whilst you could use it to clone
a new workspace, you may as well get used to managing without it as you 
won't need it for anything else.

Or, if you just fancy cloning it manually for whatever reason, use one of the
2 methods below

### If you have not cloned yet

If you are reading this before you clone, simply run


```bash
git clone --recurse-submodules <<THE URL FOR THIS REPO>>
```

### If you have already cloned without submodules

If you read this after you cloned and did not include submodules, don't
panic - just run

```bash
git submodule update --init
```

then

```bash
cd <directory that you cloned into>
```
## Running

The system can be run in 2 different ways.  The 'et_full_system' tool which
runs it in a docker compose environment but is less flexible.  Or the 'skaffold' method
which uses kubernetes which is built into docker desktop.

All commands must be run in this directory - nowhere else !

### The ET Full System Method

If you are running for the first time or you have upgraded the et_full_system gem - do
```bash
et_full_system docker reset

```

Then, once this is done - run

```bash
et_full_system docker server
```

### The Skaffold Method

First, ensure you have the following installed

- Docker Desktop (minikube may also work)
- Skaffold (https://skaffold.dev) (brew install skaffold)
- Kubectl (https://kubernetes.io/docs/tasks/tools/)
- Lens IDE (https://k8slens.dev) (Not essential - just a GUI way of seeing what kubernetes is doing)

NOTE: There may well be a tool for your IDE to run skaffold if you prefer
a GUI for this.  It is well worth it for simplicity.  I use Cloud Code IDE Extension for rubymine (https://skaffold.dev/docs/install/#managed-ide)

First, if you have never used kubernetes before in docker desktop, pop into
the preferences and you should be able to find an option to enable it.

You will need to configure kubectl to connect to docker desktop.  Hopefully, this
has been done for you.

Be VERY careful when using the skaffold method - it will use the 'context'
that kubectl was used for last.  So, if you use kubectl to connect
to live services such as the PET cluster or the C100 cluster - you must
reset the tool to use docker desktop before running this.

Failure to do so will mean that the tool tries to deploy to the wrong 
cluster.  It will probably fail early though - I have never tried it.

Feel free to read up on the skaffold tool (https://skaffold.dev) as there
is so much documentation that I won't repeat on here.  It is a general
purpose tool for using kubernetes in development and testing.  Here we
are using it for bringing up many services at once.

This environment includes a snapshot of all 6 services for employment tribunals AND
some support services such as a database, redis server, fake mail server,
fake CCD server, fake ATOS server, fake azure blob server etc..

It has all of the environment variables set correctly in both production
and development modes so it should just work.

Note: This is currently experimental and I (Gary Taylor - gary.taylor@hmcts.net) would
really appreciate your feedback.

It will sometimes have startup problems as things start in the wrong order, this 
will be improved in time as I work out how to fix these sorts of issues

So, lets get going - first check which cluster you are connected to

```bash
kubectl get nodes
```

it should respond something like this


```bash
NAME             STATUS   ROLES           AGE   VERSION
docker-desktop   Ready    control-plane   49d   v1.25.0

```

Now, lets run skaffold in production mode which is the normal
way of running it for testing.  It is not ideal for development
as changes made to the code will not be reflected in what is running
until you re start.

```bash
skaffold run

```
The first time you do this, it will have to build the docker
images which is slow.  So, go have a few cups of coffee !

Also, every time you make changes in one of the folders in the systems
folder, it will detect the changes and re build the appropriate image.

If you have errors with the 'admin-db-setup' such as this

```bash
 - deployment/admin: container admin-db-setup terminated with exit code 1
 - pod/admin-84fbf65b7b-cjpz2: container admin-db-setup terminated with exit code 1
 - deployment/admin failed. Error: container admin-db-setup terminated with exit code 1.
```

then just retry the command until you get this :-

```bash
Deployments stabilized in 1 minute 43.139 seconds
You can also run [skaffold run --tail] to get the logs

```
Remember that command 'skaffold run --tail' - you might need it

Once it is running, you can check the 'pods' in the kubernetes cluster
either using the "Lens IDE" application or the following kubectl command

```bash
kubectl get pods
```

and you should see something like this

```bash
NAME                                  READY   STATUS    RESTARTS   AGE
admin-847dd768f4-xhv5c                1/1     Running   0          2m17s
api-5898d8ccbf-hk5hl                  2/2     Running   0          2m17s
atos-758459cc58-bfz8r                 1/1     Running   0          2m17s
azurite-7476f9bbb4-sb5bm              1/1     Running   0          2m8s
db-b8988fb5b-kv4jp                    1/1     Running   0          2m12s
et-ccd-export-864c787f4-2zmjp         1/1     Running   0          2m16s
et1-6bd554fcc6-28qkl                  2/2     Running   0          2m17s
et3-56fc6ff488-cw6cx                  1/1     Running   0          2m17s
fake-services-74c6c7bd89-fdvj2        1/1     Running   0          2m15s
mailhog-85598fb645-lvgkz              1/1     Running   0          2m16s
redis-service-5bfd86b9b4-w4sb2        1/1     Running   0          2m10s
traefik-deployment-847b9684bf-rk2pf   1/1     Running   0          2m17s

```

Thats it - now go to http://et1.et.127.0.0.1.nip.io:3100 and you should see et1 running
replace 'et1' with 'et3', 'admin', 'mail', 'atos' to see the other services

If you want to watch the logs as you work, run instead of the normal 'skaffold run' command


```bash
skaffold run --tail
```

A note on resource usage:

If you 're deploy' by running skaffold run whilst it is already running,
kubernetes will try to deploy with minimum down time.  This means during 
the deployment phase, you will have 2 of everything until everything
switches over - then it will terminate the old ones.

This obviously uses extra resources on your machine - if youve got a decent
spec machine it wont be an issue - if you prefer for that not to happen
simply stop the previous version before starting a new one using this command

```bash
skaffold delete
```

This deletes the deployments in kubernetes so the pods will stop.  Confirm this
using the following

```bash
kubectl get pods
```

and you shouldn't see any of the pods running
