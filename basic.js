import * as THREE from "three";
import { OrbitControls } from "OrbitControls";
import { GLTFLoader } from "GLTFLoader";
import Stats from "Stats";
import { Octree } from "Octree";
import { Capsule } from "Capsule";
import { RGBELoader } from "RGBELoader";
import { FBXLoader } from "FBXLoader";
import { OBJLoader } from "OBJLoader";
import { MTLLoader } from "MTLLoader";

class App {
    constructor() {
        //앱 초기화
        THREE.Cache.enabled = true;
        const divContainer = document.querySelector("#webgl-container");
        this._divContainer = divContainer;

        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setPixelRatio(window.devicePixelRatio);
        divContainer.appendChild(renderer.domElement);

        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.VSMShadowMap;
        this._renderer = renderer;

        const scene = new THREE.Scene();
        this._scene = scene;


        this._setupCamera();
        this._setupLight();
        this._setupModel();
        this._setupControls();
        this._setupBackground();

        window.onresize = this.resize.bind(this);
        this.resize();

        requestAnimationFrame(this.render.bind(this));
    }

    _setupOctree(model) {
        // 충돌감지를 위해 _worldOctree 에 모델을 추가해주는 함수
        this._worldOctree = new Octree();
        this._worldOctree.fromGraphNode(model);
    }

    _setupControls() {
        // 마우스 컨트롤 설정 코드
        this._controls = new OrbitControls(this._camera, this._divContainer);
        this._controls.target.set(0, 100, 0);
        this._controls.enablePan = false;
        this._controls.enableDamping = true;

        this._pressedkeys = {};

        document.addEventListener("keydown", (event) => {
            this._pressedkeys[event.key.toLowerCase()] = true;
            this._processAnimation();
        });
        document.addEventListener("keyup", (event) => {
            this._pressedkeys[event.key.toLowerCase()] = false;
            this._processAnimation();
        });

        // fps 상태를 알려주는 코드
        const stats = new Stats();
        this._divContainer.appendChild(stats.dom);
        this._fps = stats;
    }

    _processAnimation() {
        // 키보드를 눌렀을때 캐릭터의 애니메이션과 속도를 설정해주는 함수
        const previousAnimationAction = this._currentAnimationAction;
        if (this._pressedkeys["w"] || this._pressedkeys["a"] || this._pressedkeys["s"] || this._pressedkeys["d"]
        ) {
            if (this._pressedkeys["shift"]) {
                this._currentAnimationAction = this._animationMap["Run"];
                this._maxSpeed = 450;
                this._acceleration = 3;
            } else {
                this._currentAnimationAction = this._animationMap["Walk"];
                this._maxSpeed = 120;
                this._acceleration = 3;
            }
        } else {
            this._currentAnimationAction = this._animationMap["Idle"];
            this._speed = 0;
            this._maxSpeed = 0;
            this._acceleration = 0;
        }

        if (previousAnimationAction !== this._currentAnimationAction) {
            previousAnimationAction.fadeOut(0.5);
            this._currentAnimationAction.reset().fadeIn(0.5).play();
        }
    }
    _setupBackground() {
        // 배경을 설정해주는 함수
        new RGBELoader().load(
            "./resource/texture/ground/backGround.hdr",
            (texture) => {
                texture.mapping = THREE.EquirectangularReflectionMapping;
                this._scene.background = texture; // 3차원 배경으로 사용
                this._scene.environment = texture; // 광원으로 사용
            }
        );
    }

    _loadObjModel(modelPath, size, x, y, z, path) {
        // Obj 파일을 불러와 mtl 텍스처를 입히고 모델을 생성해주는 함수
        const scene = this._scene;
        const mtlLoader = new MTLLoader();
        mtlLoader.load(path, function (materials) {
            materials.preload();

            const loader = new OBJLoader();
            loader.setMaterials(materials);
            loader.load(modelPath, (model) => {
                // Cache 사용 
                const cachedLoader = THREE.Cache.get(modelPath);
                if (typeof cachedLoader.scene == "undefined" || cachedLoader == null || cachedLoader == "") {
                    model.scale.set(size, size, size);
                    model.position.set(x, y, z);
                    model.traverse((child) => {
                        if (child instanceof THREE.Mesh) {
                            child.castShadow = true;
                        }
                    });
                    THREE.Cache.add(modelPath, { scene: model });
                    scene.add(model)
                } else {
                    // cache 에 저장된 모델이 있을때
                    console.log("로딩중")
                    const cacheModel = cachedLoader.scene.clone();
                    cacheModel.position.set(x, y, z);
                    scene.add(cacheModel);
                }
            });
        });

    }

    _loadFBXModel(modelPath, size, x, y, z, name, path) {
        // fbx 파일을 불러와 텍스처를 입히고 모델을 생성해주는 함수
        const loader = new FBXLoader();
        loader.load(modelPath, (model) => {
            // 모델 scale 값 설정
            if (name == "tiger") {
                model.rotation.x = THREE.MathUtils.degToRad(-90);
                model.rotation.z = THREE.MathUtils.degToRad(180);
            }
            model.scale.set(size, size, size);
            model.position.set(x, y, z);
            model.traverse((child) => {
                if (child instanceof THREE.Mesh) {
                    child.castShadow = true;
                    //texture를 로드
                    if (path) {
                        const material = child.material;
                        const textureLoader = new THREE.TextureLoader();
                        textureLoader.load(path, (texture) => {
                            //Texture를 Material에 할당
                            material.map = texture;
                            material.needsUpdate = true;
                        });
                    }
                }
            });
            //모델에 내장된 애니메이션을 가져와 무한 실행해주는 코드
            const animations = model.animations;
            const mixer = new THREE.AnimationMixer(model);
            const firstAnimation = name == "tiger" ? animations[3] : animations[0];
            const action = mixer.clipAction(firstAnimation);
            action.setLoop(THREE.LoopRepeat);
            action.play();

            const clock = new THREE.Clock();
            const animate = () => {
                requestAnimationFrame(animate);

                const delta = clock.getDelta();
                mixer.update(delta);
            };
            animate();
            this._scene.add(model);
        });
    }

    _makeFence(x, y, z) {
        // 울타리 모델을 설치해주는 함수
        const fbxLoader = new FBXLoader();
        fbxLoader.load("resource/data/odun.fbx", (model) => {
            const cachedLoader = THREE.Cache.get("resource/data/odun.fbx");
            if (typeof cachedLoader.scene == "undefined" || cachedLoader.scene == null || cachedLoader.scene == "") {
                THREE.Cache.add("resource/data/odun.fbx", { scene: model });
                model.scale.set(20, 50, 30);
                model.position.set(x, y, z);

                this._scene.add(model);
                this._worldOctree.fromGraphNode(model);

            } else {
                console.log("로딩중")
                const cacheModel = cachedLoader.scene.clone();
                cacheModel.position.set(x, y, z);
                this._worldOctree.fromGraphNode(cacheModel);
                this._scene.add(cacheModel);
            }
        });
    }
    _loadMaterial(name) {
        // texture 를 불러와 Material을 반환해주는 함수
        const mapTexture = new THREE.TextureLoader();
        const map = mapTexture.load((name == 'plane') ?
            "./resource/texture/ground/Ground037_4K_Color.png" :
            "./resource/texture/road/PavingStones070_4K_Color.png");
        const mapAO = mapTexture.load((name == 'plane') ?
            "./resource/texture/ground/Ground037_4K_AmbientOcclusion.png" :
            "./resource/texture/road/PavingStones070_4K_AmbientOcclusion.png");
        const mapNormal = mapTexture.load((name == 'plane') ?
            "./resource/texture/ground/Ground037_4K_NormalDX.png" :
            "./resource/texture/road/PavingStones070_4K_NormalGL.png");
        const mapRoughness = mapTexture.load((name == "plane") ?
            "./resource/texture/ground/Ground037_4K_Roughness.png" :
            "./resource/texture/road/PavingStones070_4K_Roughness.png"
        );
        map.wrapS = THREE.RepeatWrapping;
        map.wrapT = THREE.RepeatWrapping;
        map.repeat.set(5, 5);
        const mapMaterial = new THREE.MeshPhysicalMaterial({
            map: map,
            normalMap: mapNormal,

            aoMap: mapAO,
            roughnessMap: mapRoughness,
            roughness: 1,
            envMapIntensity: 0, 
        });
        return mapMaterial;
    }
    
    _setupModel() {
        //바닥을 불러오는 코드
        const planeGeometry = new THREE.PlaneGeometry(3000, 3000);
        const plane = new THREE.Mesh(planeGeometry, this._loadMaterial('plane'));
        plane.rotation.x = -Math.PI / 2;
        plane.geometry.attributes.uv2 = plane.geometry.attributes.uv;
        plane.receiveShadow = true;
        this._scene.add(plane);

        this._setupOctree(plane);

        // 길을 불러오는 코드
        const verticalRectGeo = new THREE.BoxGeometry(3000, 30, 400);
        const verticalRectMesh = new THREE.Mesh(verticalRectGeo, this._loadMaterial('road'));

        const horizontalRectGeo = new THREE.BoxGeometry(400, 30, 1300);
        const horizontalRectMesh1 = new THREE.Mesh(horizontalRectGeo, this._loadMaterial('road'));
        const horizontalRectMesh2 = new THREE.Mesh(horizontalRectGeo, this._loadMaterial('road'));

        horizontalRectMesh1.position.z = 850;
        horizontalRectMesh2.position.z = -850;

        const crossObject = new THREE.Object3D();
        crossObject.receiveShadow = true;
        crossObject.add(verticalRectMesh);
        crossObject.add(horizontalRectMesh1);
        crossObject.add(horizontalRectMesh2);

        this._worldOctree.fromGraphNode(crossObject);
        this._scene.add(crossObject);

        // 나무 모델을 불러오는 코드
        this._loadObjModel("resource/data/Sequoia_1.obj", 2, -600, 0, 300, "resource/data/Sequoia_1.mtl");
        this._loadObjModel("resource/data/Sequoia_1.obj", 2, 500, 0, 300, "resource/data/Sequoia_1.mtl");
        this._loadObjModel("resource/data/Sequoia_1.obj", 2, 900, 0, 300, "resource/data/Sequoia_1.mtl");

        this._loadObjModel("resource/data/Sequoia_1.obj", 2, 600, 0, -300, "resource/data/Sequoia_1.mtl");
        this._loadObjModel("resource/data/Sequoia_1.obj", 2, -500, 0, -300, "resource/data/Sequoia_1.mtl");
        this._loadObjModel("resource/data/Sequoia_1.obj", 2, -900, 0, -300, "resource/data/Sequoia_1.mtl");

        this._loadObjModel("resource/data/Sequoia_1.obj", 2, 300, 0, -500, "resource/data/Sequoia_1.mtl");
        this._loadObjModel("resource/data/Sequoia_1.obj", 2, 300, 0, -900,  "resource/data/Sequoia_1.mtl");
        this._loadObjModel("resource/data/Sequoia_1.obj", 2, 300, 0, 600,  "resource/data/Sequoia_1.mtl");

        this._loadObjModel("resource/data/Sequoia_1.obj", 2, -300, 0, 500,  "resource/data/Sequoia_1.mtl");
        this._loadObjModel("resource/data/Sequoia_1.obj", 2, -300, 0, 900, "resource/data/Sequoia_1.mtl");
        this._loadObjModel("resource/data/Sequoia_1.obj", 2, -300, 0, -600, "resource/data/Sequoia_1.mtl");

        // 울타리 모델을 불러오는 코드
        this._makeFence(800, -50, 800);
        this._makeFence(-800, -50, 800);
        this._makeFence(800, -50, -800);
        this._makeFence(-800, -50, -800);

        //동물 모델을 불러오는 코드
        this._loadFBXModel("resource/data/tiger.fbx", 1.1, 800, 0, 800, "tiger");
        this._loadFBXModel(
            "resource/data/penguin.fbx",
            1.1,
            -800,
            0,
            800,
            "penguin",
            "/resource/texture/animal/qi.png"
        );
        this._loadFBXModel(
            "resource/data/wolf.fbx",
            2,
            -800,
            0,
            -800,
            "wolf",
            "resource/texture/animal/Wolf_Body.jpg"
        );
        this._loadObjModel(
            "resource/data/elephant.obj",
            2,
            800,
            150,
            -800,
            "resource/data/materials.mtl"
        );

        //캐릭터 모델을 불러오는 코드
        const gLoader = new GLTFLoader();
        gLoader.load("resource/data/character.glb", (gltf) => {
            const model = gltf.scene;
            this._scene.add(model);

            model.traverse((child) => {
                if (child instanceof THREE.Mesh) {
                    child.castShadow = true;
                }
            });

            const animationClips = gltf.animations; //애니메이션 클립 객체 저장
            const mixer = new THREE.AnimationMixer(model); //프레임마다 애니메이션 업데이트
            const animationsMap = {};
            animationClips.forEach((clip) => {
                const name = clip.name;
                // console.log(name);
                animationsMap[name] = mixer.clipAction(clip);
            });

            this._mixer = mixer;
            this._animationMap = animationsMap;
            this._currentAnimationAction = this._animationMap["Idle"];
            this._currentAnimationAction.play();

            // 캐릭터를 box에 넣고 위치와 너비를 구해 Capsule객체를 만들어주는 코드
            const box = new THREE.Box3().setFromObject(model);
            model.position.y = (box.max.y - box.min.y) / 2;

            const height = box.max.y - box.min.y;
            const diameter = box.max.z - box.min.z;

            model._capsule = new Capsule(
                new THREE.Vector3(0, diameter / 2, 0),
                new THREE.Vector3(0, height - diameter / 2, 0),
                diameter / 2
            );

            this._model = model;
        });
    }

    _setupCamera() {
        // 카메라(시점)을 설정해주는 함수
        const camera = new THREE.PerspectiveCamera(
            60,
            window.innerWidth / window.innerHeight,
            1,
            5000
        );

        camera.position.set(0, 100, 500);
        this._camera = camera;
    }

    _addPointLight(x, y, z) {
        // 포인트 빛을 만들어주는 함수
        const color = 0xffffff;
        const intensity = 1.5;

        const pointLight = new THREE.PointLight(color, intensity, 1000);
        pointLight.position.set(x, y, z);

        this._scene.add(pointLight);
    }

    _setupLight() {
        // 빛을 설정하는 함수
        //전체를 밝혀주는 빛 코드
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        this._scene.add(ambientLight);

        // 설정한 포인트를 밝혀주는 빛 코드
        this._addPointLight(800, 1000, 800);
        this._addPointLight(-800, 1000, 800);
        this._addPointLight(-800, 1000, -800);
        this._addPointLight(800, 1000, -800);
        this._addPointLight(0, 1000, 0);

        // 그림자를 만들기 위한 빛 코드
        const shadowLight = new THREE.DirectionalLight(0xffffff, 0.2);
        shadowLight.position.set(200, 500, 200);
        shadowLight.target.position.set(0, 0, 0);

        this._scene.add(shadowLight);
        this._scene.add(shadowLight.target);

        shadowLight.castShadow = true;
        shadowLight.shadow.mapSize.width = 1024;
        shadowLight.shadow.mapSize.height = 1024;
        shadowLight.shadow.camera.top = shadowLight.shadow.camera.right = 700;
        shadowLight.shadow.camera.bottom = shadowLight.shadow.camera.left = -700;
        shadowLight.shadow.camera.near = 100;
        shadowLight.shadow.camera.far = 900;
        shadowLight.shadow.radius = 5;
    }

    _previousDirectionOffset = 0;

    _directionOffset() {
        // 방향키를 혼합해서 눌렀을때 캐릭터가 향하는 방향을 설정해주는 함수
        const pressedKeys = this._pressedkeys;
        let directionOffset = 0; // w

        if (pressedKeys["w"]) {
            if (pressedKeys["a"]) {
                directionOffset = Math.PI / 4; // w+a (45도)
            } else if (pressedKeys["d"]) {
                directionOffset = -Math.PI / 4; // w+d (-45도)
            }
        } else if (pressedKeys["s"]) {
            if (pressedKeys["a"]) {
                directionOffset = Math.PI / 4 + Math.PI / 2; // s+a (135도)
            } else if (pressedKeys["d"]) {
                directionOffset = -Math.PI / 4 - Math.PI / 2; // s+d (-135도)
            } else {
                directionOffset = Math.PI; // s (180도)
            }
        } else if (pressedKeys["a"]) {
            directionOffset = Math.PI / 2; // a (90도)
        } else if (pressedKeys["d"]) {
            directionOffset = -Math.PI / 2; // d (-90도)
        } else {
            directionOffset = this._previousDirectionOffset;
        }
        this._previousDirectionOffset = directionOffset;

        return directionOffset;
    }

    _speed = 0;
    _maxSpeed = 0;
    _acceleration = 0;

    _bOnTheGround = false;
    _fallingAcceleration = 0;
    _fallingSpeed = 0;

    update(time) {
        //프레임마다 업데이트해주는 함수
        time *= 0.001; // second unit

        this._controls.update();

        this._fps.update();

        if (this._mixer) {
            const deltaTime = time - this._previousTime;
            this._mixer.update(deltaTime);

            // 카메라 시점를 바뀌면 캐릭터가 그 시점을 따라 도는 코드 
            const angleCameraDirectionAxisY =
                Math.atan2(
                    this._camera.position.x - this._model.position.x,
                    this._camera.position.z - this._model.position.z
                ) + Math.PI;

            const rotateQuarternion = new THREE.Quaternion();
            rotateQuarternion.setFromAxisAngle(
                new THREE.Vector3(0, 1, 0),
                angleCameraDirectionAxisY + this._directionOffset()
            );

            this._model.quaternion.rotateTowards(
                rotateQuarternion,
                THREE.MathUtils.degToRad(5)
            );

            // 캐릭터가 움직일때 코드 - 바닥 위에 있나 판단
            const walkDirection = new THREE.Vector3();
            this._camera.getWorldDirection(walkDirection);

            walkDirection.y = this._bOnTheGround ? 0 : -1;
            walkDirection.normalize();

            walkDirection.applyAxisAngle(
                new THREE.Vector3(0, 1, 0),
                this._directionOffset()
            );
            
            // 캐릭터가 움직이면 속도를 높임
            if (this._speed < this._maxSpeed) this._speed += this._acceleration;
            else this._speed -= this._acceleration * 2;

            // 캐릭터가 바닥에 닿아있지 않다면 추락하는 코드
            if (!this._bOnTheGround) {
                this._fallingAcceleration += 1;
                this._fallingSpeed += Math.pow(this._fallingAcceleration, 2);
            } else {
                this._fallingAcceleration = 0;
                this._fallingSpeed = 0;
            }

            const velocity = new THREE.Vector3(
                walkDirection.x * this._speed,
                walkDirection.y * this._fallingSpeed,
                walkDirection.z * this._speed
            );

            const deltaPosition = velocity.clone().multiplyScalar(deltaTime);

            this._model._capsule.translate(deltaPosition);

            const result = this._worldOctree.capsuleIntersect(this._model._capsule);
            if (result) {
                //충돌했을때 위치를 변경해주는 코드
                this._model._capsule.translate(
                    result.normal.multiplyScalar(result.depth)
                );
                this._bOnTheGround = true;
            } else {
                this._bOnTheGround = false;
            }

            const previousPosition = this._model.position.clone();
            const capsuleHeight =
                this._model._capsule.end.y -
                this._model._capsule.start.y +
                this._model._capsule.radius * 2;
            this._model.position.set(
                this._model._capsule.start.x,
                this._model._capsule.start.y -
                this._model._capsule.radius +
                capsuleHeight / 2,
                this._model._capsule.start.z
            );

            this._camera.position.x -= previousPosition.x - this._model.position.x;
            this._camera.position.z -= previousPosition.z - this._model.position.z;

            this._controls.target.set(
                this._model.position.x,
                this._model.position.y,
                this._model.position.z
            );
        }
        this._previousTime = time;
    }

    render(time) {
        // 렌더링해주는 함수
        this._renderer.render(this._scene, this._camera);
        this.update(time);

        requestAnimationFrame(this.render.bind(this));
    }

    resize() {
        // 창의 사이즈가 바뀌었을때 반응하는 함수
        const width = this._divContainer.clientWidth;
        const height = this._divContainer.clientHeight;

        this._camera.aspect = width / height;
        this._camera.updateProjectionMatrix();

        this._renderer.setSize(width, height);
    }
}

window.onload = function () {
    new App();
};
