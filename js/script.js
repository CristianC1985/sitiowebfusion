let productos = [
  { "id": 1111, "name": "Crema de Peinado ARGÁN 250ml", "imagen": "./img/argan fedelite.png", "price": 4500, "description": "Es para todo tipo de cabellos. Está hecha a base de aceite virgen de Argán." },
  { "id": 2222, "name": "Máscara Capilar Argan Oils Bekim 250g", "imagen": "./img/crema argan bekim.png", "price": 4800, "description": "Baño de crema altamente hidratante y nutritivo. Repara la fibra capilar." },
  { "id": 3333, "name": "Shampoo Argán Ossono 250ml", "imagen": "./img/shampoo argan ossono.png", "price": 7000, "description": "Limpia suavemente el cabello y el cuero cabelludo." },
  { "id": 4444, "name": "Shampoo Keratina Ossono 250ml", "imagen": "./img/shampoo keratina ossono.png", "price": 6750, "description": "Limpia suavemente sin alterar el ph natural. Reestructura el cabello." },
  { "id": 5555, "name": "Mascara Argán Ossono 250ml", "imagen": "./img/mascara ossono argan.png", "price": 6500, "description": "Mascarilla cremosa e intensiva que regenera en profundidad la estructura interna." },
  { "id": 6666, "name": "Mascara Keratina Ossono 250ml", "imagen": "./img/mascara keratina ossono.png", "price": 6300, "description": "Mascarilla cremosa e intensiva con queratina hidrolizada." },
  { "id": 7777, "name": "Shampoo Karite Bekim 250g", "imagen": "./img/shampoo karite bekim.png", "price": 2900, "description": "Shampoo único a base de semillas naturales con propiedades hidratantes." },
  { "id": 8888, "name": "Shampoo Argan Oil Bekim 250g", "imagen": "./img/shampoo bekim.png", "price": 3400, "description": "Nutre y protege los cabellos extremadamente secos, apagados y débiles." },
  { "id": 9999, "name": "Shampoo Low Poo Bekim x 250g", "imagen": "./img/shampoo low poo.png", "price": 3800, "description": "Fórmula con tensio-activos suaves combinados con aceites de argán y jojoba." },
  { "id": 1000, "name": "Máscara Capilar Curly Girl Bekim 250g", "imagen": "./img/mascara bekim.png", "price": 5500, "description": "Aporta un equilibrio ideal entre hidratación, nutrición y reconstrucción." },
  { "id": 1100, "name": "Máscara Karite Bekim 250g", "imagen": "./img/mascara bekim karite.png", "price": 4250, "description": "Tratamiento capilar Hydro reparador a base de semillas naturales de Karité." },
  { "id": 1200, "name": "Crema de peinado rulos 200ml", "imagen": "./img/crema caviar.png", "price": 7000, "description": "Prolonga el efecto obtenido con bucleras. Rizos hidratados, naturales y sin frizz." }
];

let carrito = JSON.parse(localStorage.getItem("carrito")) || [];

// ── Crear tarjetas de productos ──────────────────────────────
function crearListadoProductos() {
  const contenedor = document.getElementById("productos-lista");
  contenedor.innerHTML = ""; // evita duplicados

  productos.forEach(producto => {
    const tarjeta = document.createElement("div");
    tarjeta.classList.add("card");
    tarjeta.innerHTML = `
      <img src="${producto.imagen}" alt="${producto.name}">
      <h3>${producto.name}</h3>
      <p class="card-text">${producto.description}</p>
      <p class="card-text"><strong>$${producto.price}</strong></p>
      <button class="agregar-carrito">Agregar al Carrito</button>
    `;

    tarjeta.querySelector(".agregar-carrito").addEventListener("click", () => {
      agregarProductoAlCarrito(producto);
    });

    contenedor.appendChild(tarjeta);
  });
}

// ── Carrito ──────────────────────────────────────────────────
function agregarProductoAlCarrito(producto) {
  const indice = carrito.findIndex(item => item.id === producto.id);
  if (indice !== -1) {
    carrito[indice].cantidad++;
  } else {
    carrito.push({ ...producto, cantidad: 1 });
  }
  guardarYMostrar();
  alert(`¡"${producto.name}" agregado al carrito!`);
}

function eliminarProductoCarrito(index) {
  carrito.splice(index, 1);
  guardarYMostrar();
}

function editarCantidadProducto(index, nuevaCantidad) {
  carrito[index].cantidad = nuevaCantidad;
  guardarYMostrar();
}

function vaciarCarrito() {
  carrito = [];
  guardarYMostrar();
}

function guardarYMostrar() {
  localStorage.setItem("carrito", JSON.stringify(carrito));
  mostrarCarrito();
}

function mostrarCarrito() {
  const carritoLista = document.getElementById("carrito-lista");
  const totalCarrito = document.getElementById("total-carrito");
  const contadorCarrito = document.getElementById("contador-carrito");

  carritoLista.innerHTML = "";
  let total = 0;

  carrito.forEach((producto, index) => {
    const item = document.createElement("div");
    item.classList.add("producto-carrito");
    item.innerHTML = `
      <img src="${producto.imagen}" alt="${producto.name}" width="50">
      <span>${producto.name}</span>
      <input type="number" value="${producto.cantidad}" min="1" class="cantidad" data-index="${index}">
      <span>$${producto.price}</span>
      <button class="eliminar" data-index="${index}">Eliminar</button>
    `;
    carritoLista.appendChild(item);
    total += producto.price * producto.cantidad;
  });

  totalCarrito.textContent = `$${total.toLocaleString("es-AR")}`;
  contadorCarrito.textContent = carrito.reduce((acc, p) => acc + p.cantidad, 0);

  // eventos dentro del carrito
  carritoLista.querySelectorAll(".eliminar").forEach(btn => {
    btn.addEventListener("click", e => eliminarProductoCarrito(+e.target.dataset.index));
  });
  carritoLista.querySelectorAll(".cantidad").forEach(input => {
    input.addEventListener("input", e => {
      const val = parseInt(e.target.value);
      if (val >= 1) editarCantidadProducto(+e.target.dataset.index, val);
    });
  });
}

// ── Modal carrito ────────────────────────────────────────────
document.getElementById("carrito-icono").addEventListener("click", () => {
  document.getElementById("carrito-emergente").classList.add("activo");
});

document.getElementById("volver").addEventListener("click", () => {
  document.getElementById("carrito-emergente").classList.remove("activo");
});

document.getElementById("vaciar-carrito").addEventListener("click", vaciarCarrito);

document.getElementById("finalizar-compra").addEventListener("click", () => {
  alert("¡Gracias por tu compra!");
  vaciarCarrito();
  document.getElementById("carrito-emergente").classList.remove("activo");
});

// ── Init ─────────────────────────────────────────────────────
crearListadoProductos();
mostrarCarrito();