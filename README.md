# gitops-eda

Repository for fully automated installation and configuration of the necessary environment to run GitOps/EDA on OpenShift.

> [!IMPORTANT]  
> Tested versions: 
> - OpenShift: 4.17
> - OpenShift GitOps: 1.14.0
> - Openshift Custom Metrics Autoscaler: 2.15.1-6

## Install

- Open a terminal
- Login into OpenShift (`oc` must be available on the machine running Ansible).
- Kubernetes manifests for itsm-app are **not** duplicated in this repo: [`installation/install.yaml`](installation/install.yaml) applies `namespace.yaml`, `deployment.yaml`, `service.yaml`, and `route.yaml` from the upstream [**itsm-app `k8s/`**](https://github.com/zaskan/itsm-app/tree/main/k8s) tree via raw GitHub URLs (`itsm_app_manifest_base`, overridable with `ITSM_APP_MANIFEST_BASE`). The **Secret** is created in the playbook from [`installation/vars.yaml`](installation/vars.yaml) so session/bootstrap values stay configurable.
- By default, the playbook **builds itsm-app in the cluster** from a Git **repoURL**: when the BuildConfig is missing it runs `oc new-build <repoURL#ref> --strategy=docker --name=itsm-app …` (Git URL first), then `oc start-build itsm-app --follow`. Do **not** pass a remote URL to `start-build --from-repo` — `oc` treats that flag as a **local path**. Set `ITSM_CLUSTER_BUILD=false` to skip that block if the image is already on the cluster.
- Export ITSM-related variables (defaults match the sample Secret/bootstrap unless you override):

```sh
export CLUSTER_DOMAIN=$(oc whoami --show-server | sed 's~https://api\.~~' | sed 's~:.*~~')
# Optional overrides — defaults shown are suitable for a first demo when unset:
# export ITSM_SESSION_SECRET="$(openssl rand -hex 32)"
# export ITSM_API_BASE_URL="https://itsm-app-itsm-app.apps.${CLUSTER_DOMAIN}"
# export ITSM_API_USER=admin
# export ITSM_API_PASSWORD=admin   # match bootstrap admin password / Secret
# export ITSM_BOOTSTRAP_ADMIN_USER=admin
# export ITSM_BOOTSTRAP_ADMIN_PASSWORD=admin
# export ITSM_EDA_USER_PASSWORD='R3dh4t1!'   # password for the ansible API user created by CAC
# In-cluster build (optional overrides):
# export ITSM_CLUSTER_BUILD=true              # default; set to false to skip oc new-build / start-build
# export ITSM_APP_SOURCE=https://github.com/zaskan/itsm-app.git#main   # full repoURL#ref for oc new-build
# export ITSM_APP_GIT_URL=https://github.com/zaskan/itsm-app.git       # if not using ITSM_APP_SOURCE
# export ITSM_APP_GIT_REF=main
# export ITSM_APP_MANIFEST_BASE=https://raw.githubusercontent.com/zaskan/itsm-app/main/k8s   # optional; must match ref/fork

export AAP_HOSTNAME="https://ansible-eda-aap.apps.${CLUSTER_DOMAIN}"   # EDA API; must match your route (defaults in vars.yaml if unset)
export AAP_PASSWORD="…"   # AAP admin — required for CAC (Controller + EDA modules)

ANSIBLE_CONFIG="$(pwd)/ansible.cfg" ansible-playbook installation/install.yaml -e "ocp_host=$CLUSTER_DOMAIN"
```

ansible-playbook install.yaml -e "ocp_host=$CLUSTER_DOMAIN" -e "k8s_validate_certs=false" -e "activate=false" -e aap_host=ansible-aap.apps.ocp.cluster.es -e aap_username=xxxxx -e=aap_password=xxxxx -e=install_operators=false


Defaults for hostnames follow OpenShift routes `ansible-controller-aap` and `ansible-eda-aap` (see [`installation/vars.yaml`](installation/vars.yaml)); override **`AAP_HOST`**, **`AAP_HOSTNAME`** / **`CONTROLLER_HOST`**, **`AAP_USERNAME`**, **`AAP_PASSWORD`** if your deployment differs.

Using `ANSIBLE_CONFIG` points Ansible at the repo’s [`ansible.cfg`](ansible.cfg). Roles listed in [`installation/roles/requirements.yml`](installation/roles/requirements.yml) are installed into **`~/.ansible/roles`** by the playbook (`ansible-galaxy role install` without a project-local `-p`), so nothing is copied under `installation/roles/` except that requirements file.

### ITSM in-cluster build troubleshooting

- **“has no valid source inputs … binary build”**: an old **binary** `BuildConfig` may still exist. Delete and re-run: `oc -n itsm-app delete bc/itsm-app`.
- **`stat …/installation/https:/…`**: caused by `start-build --from-repo` with an `https://` URL — remote repos belong on **`new-build`** only; use plain `oc start-build … --follow` once the BC has Git source.

### Extra variables

`-e "install_collections=true"` Install required Ansible collections

`-e "install_operators=true"` Install required Openshift operators

`-e "install_ansible_roles=false"` Skip `ansible-galaxy role install` for roles listed in [`installation/roles/requirements.yml`](installation/roles/requirements.yml) (not recommended unless roles are already present)

> **IMPORTANT NOTE** Change the storage class in pvc.yaml according to your storage classes.

### ITSM App webhook for EDA

Rulebooks use `ansible.eda.alertmanager` on port **5000** and `ansible.eda.webhook` on port **5001**.

**Automated outbound webhooks:** [`installation/casc/itsm_bootstrap.yaml`](installation/casc/itsm_bootstrap.yaml) (after loading [`installation/casc/vars/eda/activations.yaml`](installation/casc/vars/eda/activations.yaml)) builds one webhook per activation with URL **`http://<name_slug>.aap.svc.cluster.local:<port>`** (`<name_slug>` is the activation **`name`** lowercased with spaces collapsed to **`-`** for DNS-style host labels). It calls **`itsm_ansible_role`** with **`itsm_webhooks`** (multi-target REST API documented in [**demos.utils `itsm-ansible-role`**](https://github.com/zaskan/demos.utils/blob/main/roles/itsm-ansible-role/README.md)). Reinstall the Galaxy role after that repo updates (`ansible-galaxy role install … --force`). Override scheme/port/DNS suffix with **`ITSM_EDA_WEBHOOK_SCHEME`**, **`ITSM_EDA_WEBHOOK_LISTENER_PORT`**, **`ITSM_EDA_WEBHOOK_CLUSTER_DOMAIN`** or vars in [`installation/vars.yaml`](installation/vars.yaml).

Payload semantics: `event`, `timestamp`, `actor`, `incident` — [itsm-app README](https://github.com/zaskan/itsm-app/blob/main/README.md).

## Uninstall

- Open a terminal
- Login into OpenShift
- Run installation:
```sh
CLUSTER_DOMAIN=$(oc whoami --show-server | sed 's~https://api\.~~' | sed 's~:.*~~')
ansible-playbook installation/uninstall.yaml -e "ocp_host=$CLUSTER_DOMAIN"
```

Demo namespaces listed in [`installation/vars.yaml`](installation/vars.yaml) are removed, and **`itsm-app`** is deleted explicitly (it is provisioned from upstream manifests, not that list).

## Keda Demo: Run load test

In order to generate load and simulate/trigger this demo we've used K6. Review official documentation [here](https://grafana.com/docs/k6/latest/)

Install **k6** locally:

```sh
sudo dnf install https://dl.k6.io/rpm/repo.rpm
sudo dnf install k6
```

Currently, Keda is scaling based on a metric exposed by the payment application named http_requests_total. This metric returns the cumulative number of requests per pod.

The query we use `rate(http_requests_total{job="payment"}[1m])`, calculates the average rate of requests per second for each pod (or instance).

KEDA will evaluate the result independently for each instance, and if at least one pod exceeds the threshold of 1 request per second, KEDA will increase the total number of pods.

kube_horizontalpodautoscaler_status_current_replicas{horizontalpodautoscaler="keda-hpa-payment-scaler", namespace="payment"}/kube_horizontalpodautoscaler_spec_max_replicas{horizontalpodautoscaler="keda-hpa-payment-scaler", namespace="payment"}*100

To force the keda scaling use the following command:

```
k6 run script.js
```

When the alert is triggered, open the ITSM incident in [itsm-app](https://github.com/zaskan/itsm-app) and accept the Approvals in the AAP console.
The replicas should be modified in Gitea and changes should be applied by ArgoCD


## PVC Demo: Run remediation

In the Openshift console, open the terminal of the Payment Application pod.

Execute the following command to fill the disk

```
dd if=/dev/zero of=/mnt/file bs=$((1024*1024)) count=$((10*1024))
```

When the alert is triggered, open the ITSM incident in itsm-app and accept the Approvals in the AAP console.
The PVC size should be increased in Gitea and changes should be applied by ArgoCD
