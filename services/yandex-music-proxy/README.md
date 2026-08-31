# Everyyou Yandex Music proxy

Deploy this container to a Russian region, for example Yandex Cloud Serverless Containers. Set `PROXY_TOKEN` to a long random secret. Then set the same secret and the container URL in Vercel production variables:

```text
YANDEX_MUSIC_PROXY_URL=https://<container-url>
YANDEX_MUSIC_PROXY_TOKEN=<the same secret>
```

The proxy accepts only public playlist IDs and never receives a user's Yandex login or password.
