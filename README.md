# gitops-eda

Repository for fully automated installation and configuration of the necessary environment to run GitOps/EDA on OpenShift.

> [!IMPORTANT]  
> Tested versions: 
> - OpenShift: 4.17
> - OpenShift GitOps: 1.14.0

## Install

- Open a terminal
- Login into OpenShift
- Run installation:

```sh
export GLPI_API_URL=https://glpi.example.org/apirest.php
export GLPI_USERNAME=glpi
export GLPI_PASSWORD=your-glpi-password
# Optional: GLPI_USER_TOKEN, GLPI_APP_TOKEN
CLUSTER_DOMAIN=$(oc whoami --show-server | sed 's~https://api\.~~' | sed 's~:.*~~')
ansible-playbook installation/install.yaml -e "ocp_host=$CLUSTER_DOMAIN"
```

## Unnstall

- Open a terminal
- Login into OpenShift
- Run installation:
```sh
CLUSTER_DOMAIN=$(oc whoami --show-server | sed 's~https://api\.~~' | sed 's~:.*~~')
ansible-playbook installation/uninstall.yaml -e "ocp_host=$CLUSTER_DOMAIN"
```

## Run load test

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