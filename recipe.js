const { createClient } = globalThis.supabase

const SUPABASE_URL = "https://stfjdnvdqhglgqfuayok.supabase.co"
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN0ZmpkbnZkcWhnbGdxZnVheW9rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkxNDczNDksImV4cCI6MjA5NDcyMzM0OX0.nhFz-5ZvC8qE6rxMJZbRBoYRpi7yDfZeHZXg6E9239c"

const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

let allRecipes = []
let activeContinent = null

// Geographic centers (lon, lat) for badge positioning
const CONTINENT_CENTERS = {
    "North America": [-100, 45],
    "South America": [-58,  -15],
    "Europe":        [15,   52],
    "Africa":        [20,   5],
    "Asia":          [85,   45],
    "Oceania":       [135,  -25],
}

let mapProjection = null

// ─── Map init ───────────────────────────────────────────────────────────────

async function initMap() {
    const resp = await fetch("map.geojson")
    const world = await resp.json()

    const projection = d3.geoNaturalEarth1().fitSize([1000, 500], { type: "Sphere" })
    const pathGen    = d3.geoPath().projection(projection)
    mapProjection    = projection

    const continentsGroup = document.getElementById("continents")
    const clickable = ["North America", "South America", "Europe", "Africa", "Asia", "Oceania"]

    clickable.forEach(continentName => {
        const features = world.features.filter(f => f.properties.continent === continentName)
        if (!features.length) return

        const g = document.createElementNS("http://www.w3.org/2000/svg", "g")
        g.setAttribute("class", "continent")
        g.setAttribute("id", continentName.toLowerCase().replaceAll(" ", "-"))
        g.dataset.continent = continentName
        g.setAttribute("tabindex", "0")
        g.setAttribute("role", "button")
        g.setAttribute("aria-label", continentName)

        features.forEach(feature => {
            const d = pathGen(feature)
            if (!d) return
            const pathEl = document.createElementNS("http://www.w3.org/2000/svg", "path")
            pathEl.setAttribute("d", d)
            g.appendChild(pathEl)
        })

        const [cx, cy] = projection(CONTINENT_CENTERS[continentName])
        const text = document.createElementNS("http://www.w3.org/2000/svg", "text")
        text.setAttribute("x", cx)
        text.setAttribute("y", cy)
        text.setAttribute("class", "continent-label")
        text.textContent = continentName
        g.appendChild(text)

        continentsGroup.appendChild(g)
    })

    // Antarctica (non-interactive)
    world.features
        .filter(f => f.properties.continent === "Antarctica")
        .forEach(feature => {
            const d = pathGen(feature)
            if (!d) return
            const pathEl = document.createElementNS("http://www.w3.org/2000/svg", "path")
            pathEl.setAttribute("d", d)
            pathEl.setAttribute("class", "antarctica-land")
            continentsGroup.appendChild(pathEl)
        })

    document.querySelectorAll(".continent").forEach(el => {
        el.addEventListener("click", () => {
            const continent = el.dataset.continent
            if (activeContinent === continent) { closeSidebar(); return }
            document.querySelectorAll(".continent.active").forEach(c => c.classList.remove("active"))
            el.classList.add("active")
            openSidebar(continent)
        })
        el.addEventListener("keydown", e => {
            if (e.key === "Enter" || e.key === " ") { e.preventDefault(); el.click() }
        })
    })

    renderBadges()
}

// ─── Data ───────────────────────────────────────────────────────────────────

async function loadRecipes() {
    const { data, error } = await client.from("recipes").select("*")
    if (error) { console.error("Error fetching recipes:", error); return }
    allRecipes = data || []
    renderBadges()
    if (activeContinent) renderSidebarList(activeContinent)
}

// ─── Map badges ─────────────────────────────────────────────────────────────

function renderBadges() {
    const group = document.getElementById("recipe-badges")
    group.innerHTML = ""
    if (!mapProjection) return

    const counts = {}
    allRecipes.forEach(r => {
        if (r.Continent) counts[r.Continent] = (counts[r.Continent] || 0) + 1
    })

    Object.entries(counts).forEach(([continent, count]) => {
        const center = CONTINENT_CENTERS[continent]
        if (!center) return
        const [x, y] = mapProjection(center)

        const g = document.createElementNS("http://www.w3.org/2000/svg", "g")
        g.setAttribute("class", "recipe-badge")
        g.setAttribute("pointer-events", "none")

        const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle")
        circle.setAttribute("cx", x)
        circle.setAttribute("cy", y)
        circle.setAttribute("r", "11")

        const text = document.createElementNS("http://www.w3.org/2000/svg", "text")
        text.setAttribute("x", x)
        text.setAttribute("y", y)
        text.textContent = count

        g.appendChild(circle)
        g.appendChild(text)
        group.appendChild(g)
    })
}

// ─── Sidebar ─────────────────────────────────────────────────────────────────

function renderSidebarList(continentName) {
    const list   = document.getElementById("sidebar-recipe-list")
    const noMsg  = document.getElementById("no-recipes-msg")
    const recipes = allRecipes.filter(r => r.Continent === continentName)

    list.innerHTML = ""

    if (recipes.length === 0) {
        noMsg.style.display = "block"
        return
    }

    noMsg.style.display = "none"
    recipes.forEach((recipe, i) => {
        const li = document.createElement("li")
        li.className = "recipe-item"
        li.style.animationDelay = `${i * 40}ms`

        const name = document.createElement("span")
        name.className = "recipe-name"
        name.textContent = recipe.name

        const btn = document.createElement("button")
        btn.className = "recipe-delete-btn"
        btn.textContent = "Delete"
        btn.dataset.id = recipe.id
        btn.setAttribute("aria-label", `Delete ${recipe.name}`)

        li.appendChild(name)
        li.appendChild(btn)
        list.appendChild(li)
    })
}

function openSidebar(continentName) {
    activeContinent = continentName
    document.getElementById("sidebar-title").textContent = continentName
    renderSidebarList(continentName)
    document.getElementById("recipe-sidebar").classList.add("open")
    document.getElementById("recipe-sidebar").setAttribute("aria-hidden", "false")
    document.getElementById("overlay").classList.add("visible")
    // Pre-fill continent in the add modal
    document.getElementById("recipe-continent").value = continentName
}

function closeSidebar() {
    activeContinent = null
    document.getElementById("recipe-sidebar").classList.remove("open")
    document.getElementById("recipe-sidebar").setAttribute("aria-hidden", "true")
    document.getElementById("overlay").classList.remove("visible")
    document.querySelectorAll(".continent.active").forEach(el => el.classList.remove("active"))
}


document.getElementById("close-sidebar").addEventListener("click", closeSidebar)
document.getElementById("overlay").addEventListener("click", () => {
    if (document.getElementById("add-modal").classList.contains("open")) {
        closeModal()
    } else {
        closeSidebar()
    }
})

// ─── Delete (event delegation on sidebar list) ───────────────────────────────

document.getElementById("sidebar-recipe-list").addEventListener("click", async e => {
    const btn = e.target.closest(".recipe-delete-btn")
    if (!btn) return

    const id   = btn.dataset.id
    const name = btn.closest(".recipe-item").querySelector(".recipe-name").textContent

    if (!confirm(`Delete "${name}"?`)) return

    const { error } = await client.from("recipes").delete().eq("id", id)
    if (error) { console.error(error); showToast("Error deleting recipe"); return }

    showToast(`"${name}" deleted`)
    loadRecipes()
})

// ─── Add Recipe Modal ─────────────────────────────────────────────────────────

function openModal() {
    document.getElementById("add-modal").classList.add("open")
    document.getElementById("add-modal").setAttribute("aria-hidden", "false")
    document.getElementById("new-recipe").focus()
}

function closeModal() {
    document.getElementById("add-modal").classList.remove("open")
    document.getElementById("add-modal").setAttribute("aria-hidden", "true")
}

document.getElementById("open-add-modal").addEventListener("click", openModal)
document.getElementById("close-modal").addEventListener("click", closeModal)

// Close modal on backdrop click
document.getElementById("add-modal").addEventListener("click", e => {
    if (e.target === e.currentTarget) closeModal()
})

// Escape key closes modal or sidebar
document.addEventListener("keydown", e => {
    if (e.key !== "Escape") return
    if (document.getElementById("add-modal").classList.contains("open")) closeModal()
    else if (activeContinent) closeSidebar()
})

document.getElementById("add-recipe").addEventListener("click", async () => {
    const name      = document.getElementById("new-recipe").value.trim()
    const continent = document.getElementById("recipe-continent").value

    if (!name)      { showToast("Please enter a recipe name"); return }
    if (!continent) { showToast("Please choose a continent");  return }

    const { error } = await client.from("recipes").insert([{ name, Continent: continent }])
    if (error) { console.error(error); showToast("Error adding recipe"); return }

    document.getElementById("new-recipe").value      = ""
    document.getElementById("recipe-continent").value = ""
    closeModal()
    showToast(`"${name}" added!`)

    await loadRecipes()

    // Open (or refresh) the sidebar for the continent just added to
    document.querySelectorAll(".continent.active").forEach(c => c.classList.remove("active"))
    const continentEl = document.querySelector(`[data-continent="${continent}"]`)
    if (continentEl) continentEl.classList.add("active")
    openSidebar(continent)
})

document.getElementById("new-recipe").addEventListener("keydown", e => {
    if (e.key === "Enter") document.getElementById("add-recipe").click()
})

// ─── Toast ────────────────────────────────────────────────────────────────────

let toastTimer = null

function showToast(msg) {
    const toast = document.getElementById("toast")
    toast.textContent = msg
    toast.classList.add("show")
    clearTimeout(toastTimer)
    toastTimer = setTimeout(() => toast.classList.remove("show"), 2600)
}

// ─── Init ─────────────────────────────────────────────────────────────────────

initMap()
loadRecipes()
