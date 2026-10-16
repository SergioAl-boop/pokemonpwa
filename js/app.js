
const API_URL = "https://pokeapi.co/api/v2/pokemon/";
const CACHE_KEY = "pokedex-pokemon-v1";
const PAGE_SIZE = 24;

const TYPE_NAMES = {
    normal: "Normal",
    fire: "Fuego",
    water: "Agua",
    electric: "Eléctrico",
    grass: "Planta",
    ice: "Hielo",
    fighting: "Lucha",
    poison: "Veneno",
    ground: "Tierra",
    flying: "Volador",
    psychic: "Psíquico",
    bug: "Bicho",
    rock: "Roca",
    ghost: "Fantasma",
    dragon: "Dragón",
    dark: "Siniestro",
    steel: "Acero",
    fairy: "Hada"
};

const TYPE_COLORS = {
    normal: "#e5e2d8",
    fire: "#ffd6c2",
    water: "#c8e0ff",
    electric: "#fff0a8",
    grass: "#ccefd2",
    ice: "#c9f1f2",
    fighting: "#f4c6c3",
    poison: "#e8d0f5",
    ground: "#ead7b5",
    flying: "#d9dcff",
    psychic: "#ffcfe1",
    bug: "#e1edb5",
    rock: "#e2d8c2",
    ghost: "#d7d0f4",
    dragon: "#cbd3ff",
    dark: "#d3cbd0",
    steel: "#dce3eb",
    fairy: "#ffd9e8"
};

const STAT_NAMES = {
    hp: "PS",
    attack: "Ataque",
    defense: "Defensa",
    "special-attack": "At. especial",
    "special-defense": "Def. especial",
    speed: "Velocidad"
};

const grid = document.getElementById("pokemon-grid");
const searchForm = document.getElementById("search-form");
const searchInput = document.getElementById("search-input");
const statusMessage = document.getElementById("status-message");
const pokemonCount = document.getElementById("pokemon-count");
const loadMoreButton = document.getElementById("load-more");
const typeFilters = document.getElementById("type-filters");
const emptyState = document.getElementById("empty-state");
const resetButton = document.getElementById("reset-button");
const modal = document.getElementById("pokemon-modal");
const modalBody = document.getElementById("modal-body");
const closeModalButton = document.getElementById("close-modal");

let pokemonList = [];
let nextOffset = 0;
let selectedType = "all";
let isLoading = false;
let searchMode = false;
let requestNumber = 0;

function translateType(type) {
    return TYPE_NAMES[type] || type;
}

function capitalize(text) {
    return text.charAt(0).toUpperCase() + text.slice(1);
}

function formatNumber(number) {
    return `N.º ${String(number).padStart(4, "0")}`;
}

function getPokemonColor(pokemon) {
    const type = pokemon.types?.[0]?.type?.name || "normal";
    return TYPE_COLORS[type] || TYPE_COLORS.normal;
}

function getPokemonImage(pokemon) {
    return pokemon.sprites?.other?.["official-artwork"]?.front_default
        || pokemon.sprites?.front_default
        || "";
}

function savePokemonCache() {
    try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(pokemonList));
    } catch (error) {
        console.warn("No fue posible guardar la caché local.", error);
    }
}

function loadPokemonCache() {
    try {
        const saved = localStorage.getItem(CACHE_KEY);
        return saved ? JSON.parse(saved) : [];
    } catch {
        return [];
    }
}

async function fetchPokemon(url) {
    const response = await fetch(url);

    if (!response.ok) {
        throw new Error("No se pudo consultar la información del Pokémon.");
    }

    return response.json();
}

function setStatus(message) {
    statusMessage.textContent = message;
}

function renderTypes(types = []) {
    return types.map(item => {
        const name = item.type?.name || item.name || "";
        return `<span class="type-badge">${translateType(name)}</span>`;
    }).join("");
}

function renderCard(pokemon) {
    const card = document.createElement("article");
    card.className = "pokemon-card";
    card.style.setProperty("--card-color", getPokemonColor(pokemon));

    const image = getPokemonImage(pokemon);
    const types = renderTypes(pokemon.types);

    card.innerHTML = `
        <div class="card-top">
            <span class="pokemon-number">${formatNumber(pokemon.id)}</span>
            <span aria-hidden="true">✦</span>
        </div>
        <img
            class="pokemon-image"
            src="${image}"
            alt="${capitalize(pokemon.name)}"
            loading="lazy"
        >
        <h3 class="pokemon-name">${pokemon.name}</h3>
        <div class="type-list">${types}</div>
        <button class="details-button" type="button">
            Ver detalles
        </button>
    `;

    card.querySelector(".details-button").addEventListener("click", () => {
        showDetails(pokemon);
    });

    const pokemonImage = card.querySelector(".pokemon-image");

    pokemonImage.addEventListener("error", () => {
        pokemonImage.style.visibility = "hidden";
    }, { once: true });

    return card;
}

function renderPokemon(list = pokemonList) {
    const filtered = list.filter(pokemon => {
        if (selectedType === "all") return true;

        return pokemon.types?.some(
            item => item.type.name === selectedType
        );
    });

    grid.replaceChildren();

    filtered.forEach(pokemon => {
        grid.appendChild(renderCard(pokemon));
    });

    pokemonCount.textContent =
        `${filtered.length} ${filtered.length === 1 ? "Pokémon" : "Pokémon"}`;

    emptyState.hidden = filtered.length !== 0;
    loadMoreButton.hidden = searchMode || selectedType !== "all";
}

async function loadPokemonPage() {
    if (isLoading) return;

    isLoading = true;
    loadMoreButton.disabled = true;
    loadMoreButton.textContent = "Cargando...";
    setStatus("Consultando PokéAPI...");

    try {
        const response = await fetch(
            `${API_URL}?limit=${PAGE_SIZE}&offset=${nextOffset}`
        );

        if (!response.ok) {
            throw new Error("No fue posible cargar los Pokémon.");
        }

        const data = await response.json();

        const details = await Promise.all(
            data.results.map(async item => {
                const existing = pokemonList.find(
                    pokemon => pokemon.name === item.name
                );

                if (existing) return existing;

                return fetchPokemon(item.url);
            })
        );

        const existingIds = new Set(pokemonList.map(p => p.id));

        details.forEach(pokemon => {
            if (!existingIds.has(pokemon.id)) {
                pokemonList.push(pokemon);
                existingIds.add(pokemon.id);
            }
        });

        nextOffset += data.results.length;
        searchMode = false;

        savePokemonCache();
        renderPokemon();

        setStatus(
            `Se han cargado ${pokemonList.length} Pokémon.`
        );

        loadMoreButton.hidden = !data.next || selectedType !== "all";
    } catch (error) {
        console.error(error);

        if (pokemonList.length > 0) {
            renderPokemon();
            setStatus("Sin conexión. Mostrando los Pokémon guardados.");
        } else {
            setStatus(
                "No se pudieron cargar los Pokémon. Conéctate a Internet e inténtalo de nuevo."
            );
            emptyState.hidden = false;
        }
    } finally {
        isLoading = false;
        loadMoreButton.disabled = false;
        loadMoreButton.textContent = "Cargar más Pokémon";
    }
}

async function searchPokemon(query) {
    const currentRequest = ++requestNumber;
    const value = query.trim().toLowerCase();

    if (!value) {
        searchMode = false;
        selectedType = "all";
        updateFilterButtons();
        renderPokemon();
        setStatus("Mostrando los Pokémon cargados.");
        loadMoreButton.hidden = false;
        return;
    }

    searchMode = true;
    loadMoreButton.hidden = true;
    setStatus("Buscando Pokémon...");
    grid.replaceChildren();
    emptyState.hidden = true;

    const cached = pokemonList.filter(pokemon =>
        pokemon.name.includes(value) ||
        String(pokemon.id) === value
    );

    try {
        const pokemon = await fetchPokemon(`${API_URL}${encodeURIComponent(value)}/`);

        if (currentRequest !== requestNumber) return;

        const existingIndex = pokemonList.findIndex(
            item => item.id === pokemon.id
        );

        if (existingIndex >= 0) {
            pokemonList[existingIndex] = pokemon;
        } else {
            pokemonList.push(pokemon);
        }

        savePokemonCache();
        selectedType = "all";
        updateFilterButtons();
        renderPokemon([pokemon]);
        setStatus(`Se encontró a ${capitalize(pokemon.name)}.`);
    } catch (error) {
        if (currentRequest !== requestNumber) return;

        const results = cached.length > 0
            ? cached
            : pokemonList.filter(pokemon =>
                pokemon.name.includes(value) ||
                String(pokemon.id) === value
            );

        selectedType = "all";
        updateFilterButtons();
        renderPokemon(results);

        if (results.length > 0) {
            setStatus("Mostrando coincidencias guardadas sin conexión.");
        } else {
            setStatus("No se encontró ese Pokémon o no hay conexión.");
        }
    }
}

function showDetails(pokemon) {
    const color = getPokemonColor(pokemon);
    const image = getPokemonImage(pokemon);

    const abilities = pokemon.abilities.map(item => `
        <span class="ability">
            ${item.ability.name.replaceAll("-", " ")}
            ${item.is_hidden ? "(Oculta)" : ""}
        </span>
    `).join("");

    const stats = pokemon.stats.map(item => {
        const value = item.base_stat;
        const percentage = Math.min((value / 150) * 100, 100);

        return `
            <div class="stat-row">
                <span>${STAT_NAMES[item.stat.name] || item.stat.name}</span>
                <div class="stat-track">
                    <div class="stat-fill" style="width: ${percentage}%"></div>
                </div>
                <strong>${value}</strong>
            </div>
        `;
    }).join("");

    modalBody.innerHTML = `
        <div class="detail-header" style="--card-color: ${color}">
            <span class="detail-number">${formatNumber(pokemon.id)}</span>
            <img class="detail-image" src="${image}" alt="${pokemon.name}">
            <h2 id="modal-name">${pokemon.name}</h2>
            <div class="type-list" style="justify-content:center">
                ${renderTypes(pokemon.types)}
            </div>
        </div>

        <section class="detail-section">
            <h3>Características</h3>
            <div class="detail-info">
                <div class="info-box">
                    <span>Altura</span>
                    <strong>${(pokemon.height / 10).toFixed(1)} m</strong>
                </div>
                <div class="info-box">
                    <span>Peso</span>
                    <strong>${(pokemon.weight / 10).toFixed(1)} kg</strong>
                </div>
                <div class="info-box">
                    <span>Experiencia base</span>
                    <strong>${pokemon.base_experience ?? "No disponible"}</strong>
                </div>
                <div class="info-box">
                    <span>Orden</span>
                    <strong>${pokemon.order}</strong>
                </div>
            </div>
        </section>

        <section class="detail-section">
            <h3>Habilidades</h3>
            <div class="ability-list">
                ${abilities || "Sin habilidades disponibles"}
            </div>
        </section>

        <section class="detail-section">
            <h3>Estadísticas base</h3>
            ${stats}
        </section>
    `;

    modal.hidden = false;
    document.body.style.overflow = "hidden";
    closeModalButton.focus();
}

function closeModal() {
    modal.hidden = true;
    document.body.style.overflow = "";
}

function updateFilterButtons() {
    typeFilters.querySelectorAll(".filter-button").forEach(button => {
        button.classList.toggle(
            "active",
            button.dataset.type === selectedType
        );
    });
}

searchForm.addEventListener("submit", event => {
    event.preventDefault();
    searchPokemon(searchInput.value);
});

typeFilters.addEventListener("click", event => {
    const button = event.target.closest(".filter-button");

    if (!button) return;

    selectedType = button.dataset.type;
    searchMode = false;
    updateFilterButtons();
    renderPokemon();
    setStatus(
        selectedType === "all"
            ? "Mostrando todos los Pokémon cargados."
            : `Filtro: ${translateType(selectedType)}.`
    );
});

loadMoreButton.addEventListener("click", loadPokemonPage);

resetButton.addEventListener("click", () => {
    searchInput.value = "";
    searchMode = false;
    selectedType = "all";
    updateFilterButtons();
    renderPokemon();
    loadMoreButton.hidden = false;
    setStatus("Mostrando los Pokémon guardados.");
});

closeModalButton.addEventListener("click", closeModal);

modal.addEventListener("click", event => {
    if (event.target.dataset.close === "true") {
        closeModal();
    }
});

document.addEventListener("keydown", event => {
    if (event.key === "Escape" && !modal.hidden) {
        closeModal();
    }
});

async function initializeApp() {
    pokemonList = loadPokemonCache();

    if (pokemonList.length > 0) {
        nextOffset = Math.max(...pokemonList.map(p => p.id));
        renderPokemon();
        setStatus("Mostrando Pokémon guardados. Actualizando...");
    }

    await loadPokemonPage();
}

if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
        navigator.serviceWorker.register("./serviceworker.js")
            .catch(error => {
                console.error("Error al registrar el Service Worker:", error);
            });
    });
}

initializeApp();
