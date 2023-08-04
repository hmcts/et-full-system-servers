# et-full-system-servers
This repository contains the 5 submodules for employment tribunals along with
the relevant docker compose files to run them all together.

## Cloning

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
runs it in a docker compose environment but is less flexible.  Or the 'docker compose' method
which uses docker compose which is built into docker desktop.

To run in docker compose, please make sure that if you are using docker desktop that
it is not restricted too much.  The entire system needs 2GB of memory and at least 2 CPUs
but the more you can give it, the better.

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

### The Docker Compose Method

First, ensure you have the following installed

- Docker Desktop (https://www.docker.com/products/docker-desktop)


Then, run the following command

```bash
docker compose up --build
```

you should see lots of logs flying by, but there is a message that will
display once it has finished and it looks like this

```bash
et-full-system-servers-finished-development-1       | ******************************************************************
et-full-system-servers-finished-development-1       | *                                                                *
et-full-system-servers-finished-development-1       | *         All services are now ready for use                     *
et-full-system-servers-finished-development-1       | *                                                                *
et-full-system-servers-finished-development-1       | ******************************************************************
et-full-system-servers-finished-development-1 exited with code 0


```

Note that after this, you will start to see 'ping.json' requests which docker uses
for health checks, so if you weren't watching carefully, you might need to scroll up a bit.

#### Stopping

To stop the system, press CTRL-C in the terminal window where you ran the command.

#### Restarting

After the system has been run for the first time, the databases will be present,
the images will be built etc..  So restarting is much quicker.  To restart, simply
use the same command as for running the system.

If you are 100% sure that no files have changed since last time, you can omit the '--build'
from the command.  However, this adds very little time as docker caches the results of
previous builds anyway.

#### Resetting

If you have a need to restart but scrapping your databases and starting again, you can
use the following command

```bash
docker compose down -v
```

and then restart as normal.

If you need to go further and scrap the images as well, you can use

```bash 
docker compose down -v --rmi all
```

and then restart as normal.

-------------------------------------------

