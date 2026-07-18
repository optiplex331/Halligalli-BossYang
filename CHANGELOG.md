# Changelog

## [0.8.3](https://github.com/optiplex331/Halligalli-BossYang/compare/v0.8.2...v0.8.3) (2026-07-18)


### Bug Fixes

* **web:** speed up reveals and float game feedback ([#89](https://github.com/optiplex331/Halligalli-BossYang/issues/89)) ([bd1b6ad](https://github.com/optiplex331/Halligalli-BossYang/commit/bd1b6adcfd23d30584a032ea808611769518f099))

## [0.8.2](https://github.com/optiplex331/Halligalli-BossYang/compare/v0.8.1...v0.8.2) (2026-07-18)


### Bug Fixes

* **web:** rebalance reveal timing ([#87](https://github.com/optiplex331/Halligalli-BossYang/issues/87)) ([74f930f](https://github.com/optiplex331/Halligalli-BossYang/commit/74f930ff4e44d29f0cb6710dbb739ae27fbc2005))

## [0.8.1](https://github.com/optiplex331/Halligalli-BossYang/compare/v0.8.0...v0.8.1) (2026-07-18)


### Bug Fixes

* **web:** keep table cards fully visible ([#84](https://github.com/optiplex331/Halligalli-BossYang/issues/84)) ([8cab7be](https://github.com/optiplex331/Halligalli-BossYang/commit/8cab7be7e61db5b9fcc4e833468113d6f264007c))

## [0.8.0](https://github.com/optiplex331/Halligalli-BossYang/compare/v0.7.2...v0.8.0) (2026-07-16)


### Features

* **game:** separate table seats and harden release identity ([#72](https://github.com/optiplex331/Halligalli-BossYang/issues/72)) ([8289fa6](https://github.com/optiplex331/Halligalli-BossYang/commit/8289fa67387285de1a967998cbb859d5bb5193bc))


### Bug Fixes

* **ci:** pin actionlint binary version ([284f8e4](https://github.com/optiplex331/Halligalli-BossYang/commit/284f8e430c7d4f5617de5b3a85b11de1ec1afe6c))
* **release:** align manifest with latest release ([29d706a](https://github.com/optiplex331/Halligalli-BossYang/commit/29d706af3b24b5f030242b1410cc3daac98199a0))
* **release:** align manifest with latest release ([f0150ff](https://github.com/optiplex331/Halligalli-BossYang/commit/f0150ff40d0184d916ad678aba7b29039bd7ae23))

## [0.7.2](https://github.com/optiplex331/Halligalli-BossYang/compare/v0.7.1...v0.7.2) (2026-07-13)


### Bug Fixes

* **api:** count active Redis rooms asynchronously ([#66](https://github.com/optiplex331/Halligalli-BossYang/issues/66)) ([23cb9f6](https://github.com/optiplex331/Halligalli-BossYang/commit/23cb9f6a3781ec2c7a51c508d6d362f5910d8f5f))

## [0.7.1](https://github.com/optiplex331/Halligalli-BossYang/compare/v0.7.0...v0.7.1) (2026-07-13)


### Bug Fixes

* **release:** pin paired smoke dependency ([#64](https://github.com/optiplex331/Halligalli-BossYang/issues/64)) ([08984cf](https://github.com/optiplex331/Halligalli-BossYang/commit/08984cfd90e96bc191f2a29e164641178737bfc3))

## [0.7.0](https://github.com/optiplex331/Halligalli-BossYang/compare/v0.6.0...v0.7.0) (2026-07-13)


### Features

* **api:** add authenticated room entry ([75cea47](https://github.com/optiplex331/Halligalli-BossYang/commit/75cea47e0cb7677e79051397ed8135dbb4d0d518))
* **api:** add privacy-safe observability ([02e80db](https://github.com/optiplex331/Halligalli-BossYang/commit/02e80dbff7612ddc46b79fbc784a5be9accd1f73))
* **api:** export privacy-safe OTLP traces ([7a057be](https://github.com/optiplex331/Halligalli-BossYang/commit/7a057be7566c3a7f17fe504a2bb2e5af5994fc0e))
* **dev:** add clean compose path ([faa7100](https://github.com/optiplex331/Halligalli-BossYang/commit/faa710014ce2905af337f1af04f23d012b1e698a))
* **multiplayer:** add two-seat authority match ([74b22b8](https://github.com/optiplex331/Halligalli-BossYang/commit/74b22b840e26f7cd85bf0ddbef828cec75f0fef4))
* **multiplayer:** complete ephemeral room lifecycle ([ce3613f](https://github.com/optiplex331/Halligalli-BossYang/commit/ce3613fa6233063b9f1a27c44ed1d4b3ffd16c93))
* **multiplayer:** enforce score breakdown parity ([5e40e89](https://github.com/optiplex331/Halligalli-BossYang/commit/5e40e8956e65bd9e0f65b20c37aa0f90d37257cf))
* **multiplayer:** extend authority matches to six seats ([69f7e3b](https://github.com/optiplex331/Halligalli-BossYang/commit/69f7e3b9190998ba26e4f81d3388c6ede5f2468f))
* **platform:** deliver paired FastAPI runtime ([f047a07](https://github.com/optiplex331/Halligalli-BossYang/commit/f047a07269e2c79b044c3cc929c6c628a34bdb4e))
* **release:** publish verified paired images ([21d511f](https://github.com/optiplex331/Halligalli-BossYang/commit/21d511fabe7496b2850ea489f620a1d5a616b8c6))
* **web:** migrate single-player into monorepo ([a47f8ff](https://github.com/optiplex331/Halligalli-BossYang/commit/a47f8ffe0483959566d54850db69eb001adc7e51))


### Bug Fixes

* **api:** relay Redis revisions to room sockets ([8e1cdd5](https://github.com/optiplex331/Halligalli-BossYang/commit/8e1cdd5bcbccbbe6b4d6eb05c0f1355be4363e78))
* **api:** write telemetry logs to stdout ([ffd3fa2](https://github.com/optiplex331/Halligalli-BossYang/commit/ffd3fa251d00f29126e0d5ce961c40abddf3855e))
* **ci:** install uv for API checks ([6f6ef37](https://github.com/optiplex331/Halligalli-BossYang/commit/6f6ef372d12758ef8e895c55f9aa81415b9645f7))
* **ci:** preserve required container check name ([9ff7a65](https://github.com/optiplex331/Halligalli-BossYang/commit/9ff7a65f850e39d01c00c87616c6e898abb58fe2))
* **release:** attest paired image digests ([287175d](https://github.com/optiplex331/Halligalli-BossYang/commit/287175da8a67e46c743ddb5276227094ea0f055e))
* **web:** refresh secure nginx runtime ([96e9101](https://github.com/optiplex331/Halligalli-BossYang/commit/96e9101c1eaca228eedd58fa40b88bf7255ae0c6))

## [0.6.0](https://github.com/optiplex331/Halligalli-BossYang/compare/v0.5.1...v0.6.0) (2026-07-10)


### Features

* **platform:** prepare attested GitOps release baseline ([016f380](https://github.com/optiplex331/Halligalli-BossYang/commit/016f380edf44f39fa3fea19713171b02d9015b3c))
* **release:** publish attestation release assets ([e108ef5](https://github.com/optiplex331/Halligalli-BossYang/commit/e108ef5995793199a1a2561902e19fbffd6e4117))
* **release:** publish release attestation ([26cfcc0](https://github.com/optiplex331/Halligalli-BossYang/commit/26cfcc0fa93924e9b375c41dceda11b48f5d9c8d))


### Bug Fixes

* **ci:** align release utility routing and image identity ([d655207](https://github.com/optiplex331/Halligalli-BossYang/commit/d6552074d2a4b440d659b0ab322db52684257bf7))
* **ci:** align release utility routing and image identity ([a160577](https://github.com/optiplex331/Halligalli-BossYang/commit/a16057709b53a4dfcc2ca71529d6a8482292f3a1))
* **multiplayer:** narrow projected bell outcomes ([396a5cc](https://github.com/optiplex331/Halligalli-BossYang/commit/396a5cc1ea8e2b10feb57f91601c017a1e639e5f))

## [0.5.1](https://github.com/optiplex331/Halligalli-BossYang/compare/v0.5.0...v0.5.1) (2026-06-21)


### Bug Fixes

* **multiplayer:** use server reaction time ([#47](https://github.com/optiplex331/Halligalli-BossYang/issues/47)) ([95197c9](https://github.com/optiplex331/Halligalli-BossYang/commit/95197c946a92ad01b2f2420f1441c90509bae508))

## [0.5.0](https://github.com/optiplex331/Halligalli-BossYang/compare/v0.4.1...v0.5.0) (2026-06-19)


### Features

* **kubernetes:** add Halligalli Helm chart ([77c93e2](https://github.com/optiplex331/Halligalli-BossYang/commit/77c93e2201835cb7243f72df7f706ec2ec293071))
* **kubernetes:** prepare Azure Kubernetes Phase A packaging ([a7f4e84](https://github.com/optiplex331/Halligalli-BossYang/commit/a7f4e84be52d8bb66373fd5e9a42bf9e634cae8b))


### Bug Fixes

* **deps:** pin socket.io transitive patches ([7964055](https://github.com/optiplex331/Halligalli-BossYang/commit/79640553789a1a7d7de82ac5ea523f6b1e49ed2a))

## [0.4.1](https://github.com/optiplex331/Halligalli-BossYang/compare/v0.4.0...v0.4.1) (2026-06-10)


### Bug Fixes

* **deploy:** release backend-only Azure image ([87c08e3](https://github.com/optiplex331/Halligalli-BossYang/commit/87c08e3c186fd4648e5908ac20c57ff4dd239e28))

## [0.4.0](https://github.com/optiplex331/Halligalli-BossYang/compare/v0.3.0...v0.4.0) (2026-06-04)


### Features

* **deploy:** switch production templates to AWS ([#30](https://github.com/optiplex331/Halligalli-BossYang/issues/30)) ([91605af](https://github.com/optiplex331/Halligalli-BossYang/commit/91605afda7377dc5d6186bdadd1df94d6b2e4978))

## [0.3.0](https://github.com/optiplex331/Halligalli-BossYang/compare/v0.2.0...v0.3.0) (2026-06-03)


### Features

* **aws-staging:** scaffold portfolio environment ([4155db5](https://github.com/optiplex331/Halligalli-BossYang/commit/4155db5d7c0636f1f785c3042bfb5dd426d71c01))
* **ci:** harden aws staging activation ([1db0d31](https://github.com/optiplex331/Halligalli-BossYang/commit/1db0d311bbb313a898679a0e121f36a32586ddfa))


### Bug Fixes

* **app:** sync Vite entrypoint and release docs ([539ff83](https://github.com/optiplex331/Halligalli-BossYang/commit/539ff83077d32dc31c9e31667e7c7eb850d4d3d0))

## [0.2.0](https://github.com/optiplex331/Halligalli-BossYang/compare/v0.1.0...v0.2.0) (2026-05-23)


### Features

* **gitops:** add normalized production release flow ([#9](https://github.com/optiplex331/Halligalli-BossYang/issues/9)) ([bcda206](https://github.com/optiplex331/Halligalli-BossYang/commit/bcda2069882c5b00543b7e3d240f7dd50e614528))
* **typescript:** migrate product to TypeScript ([#8](https://github.com/optiplex331/Halligalli-BossYang/issues/8)) ([b051852](https://github.com/optiplex331/Halligalli-BossYang/commit/b051852b28e1f2bd2f8e5f64d0d142a3d5abe63c))
