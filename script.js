function getTodayIso() {
  return new Date().toISOString().slice(0, 10);
}

function getAge(dateStr) {
  var birth = new Date(dateStr + "T00:00:00");
  var today = new Date();
  var age = today.getFullYear() - birth.getFullYear();
  var m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

function buildDestUrl() {
  // Monta destino relativo: /1 com todos os parâmetros da URL atual preservados
  var dest = new URL("1/index.html", window.location.href);
  var params = new URLSearchParams(window.location.search);
  params.forEach(function(val, key) {
    dest.searchParams.set(key, val);
  });
  return dest.toString();
}

function showError(msg) {
  var el   = document.getElementById("age-error");
  var txt  = document.getElementById("age-error-text");
  var wrap = document.getElementById("date-field-wrap");
  txt.textContent = msg;
  el.style.display = "flex";
  wrap.classList.add("error");
  document.getElementById("birth-date").setAttribute("aria-describedby", "age-error");
}

function clearError() {
  var el   = document.getElementById("age-error");
  var wrap = document.getElementById("date-field-wrap");
  el.style.display = "none";
  wrap.classList.remove("error");
  document.getElementById("birth-date").setAttribute("aria-describedby", "age-note");
}

document.addEventListener("DOMContentLoaded", function() {
  var today = getTodayIso();
  var input = document.getElementById("birth-date");
  input.max = today;

  input.addEventListener("change", function() {
    if (document.getElementById("age-error").style.display !== "none") clearError();
  });

  document.getElementById("age-form").addEventListener("submit", function(e) {
    e.preventDefault();
    clearError();

    var birthDate = input.value;

    if (!birthDate) {
      showError("Informe sua data de nascimento para continuar.");
      return;
    }

    var selected = new Date(birthDate + "T00:00:00");
    if (isNaN(selected.getTime()) || birthDate > today) {
      showError("Escolha uma data válida.");
      return;
    }

    if (getAge(birthDate) < 18) {
      showError("Este conteúdo é destinado a maiores de 18 anos.");
      return;
    }

    // Sucesso — anima botão e redireciona para /1 com todos os parâmetros
    var btn       = document.getElementById("continue-btn");
    var btnText   = document.getElementById("btn-text");
    var iconArrow = document.getElementById("btn-icon-arrow");
    var iconCheck = document.getElementById("btn-icon-check");

    btn.disabled = true;
    btnText.textContent = "Abrindo conteúdo";
    iconArrow.style.display = "none";
    iconCheck.style.display = "block";

    setTimeout(function() {
      window.location.href = buildDestUrl();
    }, 220);
  });
});
