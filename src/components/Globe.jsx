import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import earthTexture from "../assets/2k_earth_daymap.jpg";
import axios from "axios";
import cities from "../cities.js";

const Globe = () => {
  const mountRef = useRef(null);
  const [weather, setWeather] = useState(null);
  const [hoveredCity, setHoveredCity] = useState(null);

  const fetchWeather = async (lat, lon) => {
    const apiKey = "34d1090385f1593dd0027194d3bf1656";
    try {
      const response = await axios.get(
        `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`
      );
      setWeather(response.data);
    } catch (error) {
      console.error("Ошибка с погодой:", error);
      setWeather(null);
    }
  };

  useEffect(() => {
    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    if (mountRef.current) {
      mountRef.current.appendChild(renderer.domElement);
    }

    const texture = new THREE.TextureLoader().load(earthTexture);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;

    const geometry = new THREE.SphereGeometry(5, 64, 64);
    const material = new THREE.MeshStandardMaterial({ map: texture });
    const sphere = new THREE.Mesh(geometry, material);
    scene.add(sphere);

    const light = new THREE.AmbientLight(0x404040, 2);
    scene.add(light);

    const pointLight = new THREE.PointLight(0xffffff, 1.5, 100);
    pointLight.position.set(10, 10, 10);
    scene.add(pointLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
    directionalLight.position.set(5, 5, 5);
    scene.add(directionalLight);

    fetchWeather();

    const getPosition = (lat, lon, radius) => {
      const phi = (90 - lat) * (Math.PI / 180);
      const theta = (lon + 180) * (Math.PI / 180);
      const x = -radius * Math.sin(phi) * Math.cos(theta);
      const y = radius * Math.cos(phi);
      const z = radius * Math.sin(phi) * Math.sin(theta);
      return { x, y, z };
    };

    const createCityMarker = (city) => {
      const { lat, lon, name } = city;
      const pos = getPosition(lat, lon, 5.05);

      const pointMaterial = new THREE.MeshPhongMaterial({
        color: 0x5a0000,
        transparent: true,
        opacity: 0.9,
      });

      const pointGeometry = new THREE.SphereGeometry(0.08, 16, 16);
      const point = new THREE.Mesh(pointGeometry, pointMaterial);
      point.position.set(pos.x, pos.y, pos.z);

      const glowMaterial = new THREE.MeshBasicMaterial({
        color: 0x8b0000,
        transparent: true,
        opacity: 0.4,
      });

      const glowGeometry = new THREE.SphereGeometry(0.15, 16, 16);
      const glow = new THREE.Mesh(glowGeometry, glowMaterial);
      glow.position.set(pos.x, pos.y, pos.z);

      let scale = 1;
      const animateGlow = () => {
        scale = scale > 1.2 ? 1 : scale + 0.002;
        glow.scale.set(scale, scale, scale);
        setTimeout(() => requestAnimationFrame(animateGlow), 5);
      };
      animateGlow();

      point.userData = { lat, lon, name };
      sphere.add(point);
      sphere.add(glow);
      return point;
    };

    const cityMarkers = cities.map((city) => createCityMarker(city));

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const onClick = (event) => {
      event.preventDefault();
      mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
      mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(cityMarkers);
      if (intersects.length > 0) {
        const city = intersects[0].object.userData;
        fetchWeather(city.lat, city.lon);
      }
    };
    window.addEventListener("click", onClick);

    camera.position.set(0, 0, 10);
    camera.lookAt(0, 0, 0);

    let isDragging = false;
    let previousMouseX = 0;
    let previousMouseY = 0;

    const onMouseDown = (event) => {
      event.preventDefault();
      isDragging = true;
      previousMouseX = event.clientX;
      previousMouseY = event.clientY;
    };

    const onMouseMove = (event) => {
      event.preventDefault();

      if (isDragging) {
        const deltaX = (event.clientX - previousMouseX) * 0.005;
        const deltaY = (event.clientY - previousMouseY) * 0.005;

        sphere.rotation.y += deltaX;
        sphere.rotation.x += deltaY;

        previousMouseX = event.clientX;
        previousMouseY = event.clientY;
      } else {
        const mouse = new THREE.Vector2();
        mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObjects(cityMarkers);

        if (intersects.length > 0) {
          const city = intersects[0].object.userData;
          setHoveredCity(city);
          fetchWeather(city.lat, city.lon);
        } else {
          setHoveredCity(null);
        }
      }
    };

    const onMouseUp = (event) => {
      event.preventDefault();
      isDragging = false;
    };

    renderer.domElement.addEventListener("mousedown", onMouseDown);
    renderer.domElement.addEventListener("mousemove", onMouseMove);
    renderer.domElement.addEventListener("mouseup", onMouseUp);

    const animate = () => {
      requestAnimationFrame(animate);

      renderer.render(scene, camera);
    };

    animate();

    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };

    window.addEventListener("resize", handleResize);

    return () => {
      if (mountRef.current && renderer.domElement) {
        mountRef.current.removeChild(renderer.domElement);
      }
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, []);

  return (
    <div className="relative w-full h-full">
      <div ref={mountRef} className="w-full h-full" />
      {hoveredCity && (
        <div className="absolute top-4 left-4 flex space-x-4">
          {weather && (
            <div className="bg-gray-800 text-white p-1 rounded shadow-md opacity-90 duration-300 w-18 flex flex-col">
              <div className="flex">
                <h2 className="text-[6px] font-bold align-center">
                  {hoveredCity.name}
                </h2>
                <img
                  src={`http://openweathermap.org/img/wn/${weather.weather[0].icon}.png`}
                  alt="Weather icon"
                  className="w-2 h-2 mr-1"
                />
              </div>
              <div className="flex">
                <div>
                  <p className="text-[6px]">
                    {weather.main.temp}°C, {weather.weather[0].description}
                  </p>
                </div>
              </div>
              <p className="text-[6px]">Humidity: {weather.main.humidity}%</p>
              <p className="text-[6px]">Wind: {weather.wind.speed} m/s</p>
              <p className="text-[6px]">
                Pressure: {weather.main.pressure} hPa
              </p>
              <p className="text-[6px]">Clouds: {weather.clouds.all}%</p>
              {weather.rain?.["1h"] && (
                <p className="text-[6px]">Rain (1h): {weather.rain["1h"]} mm</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Globe;
