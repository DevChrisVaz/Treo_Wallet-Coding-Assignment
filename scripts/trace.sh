#!/usr/bin/env bash
# Matriz de trazabilidad: requisito -> tarea -> commit -> prueba.
#
# Uso:  scripts/trace.sh [--check]
#   Escribe en stdout una tabla Markdown y la lista de huecos.
#   Con --check termina con código 1 si hay algún hueco (y con 0 si no).
#
# Fuentes (sin dependencias fuera de git, find, grep, sort y awk):
#   requisitos  openspec/specs/**/spec.md y openspec/changes/**/specs/**/spec.md
#               (incluido archive/), líneas "### Requirement: XXX-NN Título"
#   tareas      openspec/changes/**/tasks.md (incluido archive/), líneas
#               "- [x] 1.2 [api] texto (XXX-NN)"; un requisito pertenece a una
#               tarea si su ID aparece en la línea
#   commits     trailers "Task: <change>#<n.m>" y "Refs: XXX-NN, ..."
#   pruebas     archivos *.test.* y *.spec.* de contract, api, web, mobile y
#               design-tokens cuyo it/test/describe tiene un título que empieza
#               con uno o más IDs (el título puede ir en la línea siguiente)
set -euo pipefail

check=0
case "${1:-}" in
  --check) check=1 ;;
  "") ;;
  *) echo "Uso: $0 [--check]" >&2; exit 2 ;;
esac

cd "$(git rev-parse --show-toplevel)"

# Nombre del change a partir de la ruta de un archivo de OpenSpec ("-" para openspec/specs).
change_of() {
  case $1 in
    openspec/specs/*) echo "-" ;;
    *) c=${1#openspec/changes/}; c=${c#archive/}; c=${c%%/*}
       echo "${c#[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]-}" ;;
  esac
}

# Cada fuente emite líneas "TIPO<TAB>campos". El orden importa: R, T, C y P.
emit() {
  find openspec -name spec.md -path '*/specs/*' | sort | while IFS= read -r f; do
    ch=$(change_of "$f")
    awk -v ch="$ch" '/^### Requirement: [A-Z]+-[0-9]+/ {
      id = $3; t = $0; sub(/^### Requirement: [A-Z]+-[0-9]+ */, "", t)
      printf "R\t%s\t%s\t%s\n", id, t, ch }' "$f"
  done

  find openspec -name tasks.md | sort | while IFS= read -r f; do
    ch=$(change_of "$f")
    awk -v ch="$ch" '/^- \[[ x]\] [^ ]+ / {
      line = $0; refs = ""
      while (match(line, /[A-Z]+-[0-9]+/)) {
        refs = refs " " substr(line, RSTART, RLENGTH); line = substr(line, RSTART + RLENGTH) }
      printf "T\t%s#%s\t%s\n", ch, $3, refs }' "$f"
  done

  git log --format='%h%x1f%(trailers:key=Task,valueonly,separator=%x2C)%x1f%(trailers:key=Refs,valueonly,separator=%x2C)' |
    awk -F '\037' '{ printf "C\t%s\t%s\t%s\n", $1, $2, $3 }'

  find contract api web mobile design-tokens \
      \( -name node_modules -o -name dist -o -name .next -o -name coverage \) -prune -o \
      -type f \( -name '*.test.*' -o -name '*.spec.*' \) -print0 2>/dev/null |
    xargs -0 awk '
      FNR == 1 { pending = 0 }
      {
        rest = ""
        if (pending && match($0, /^[ \t]*[\047"`]/)) { rest = substr($0, RLENGTH + 1); pending = 0 }
        else if (match($0, /(^|[^A-Za-z])(it|test|describe)[.A-Za-z]*(\(|\)\()[ \t]*[\047"`]/)) rest = substr($0, RSTART + RLENGTH)
        else { pending = ($0 ~ /(^|[^A-Za-z])(it|test|describe)[.A-Za-z]*\($/); next }
        pending = 0
        while (match(rest, /^[A-Z]+-[0-9]+[ ,]*/)) {
          id = substr(rest, 1, RLENGTH); gsub(/[ ,]/, "", id)
          printf "P\t%s\t%s\n", id, FILENAME
          rest = substr(rest, RLENGTH + 1)
        }
      }'
}

# Une las cuatro fuentes. Imprime filas "ID<TAB>fila" y, al final, líneas "GAP<TAB>tipo<TAB>ID<TAB>título".
join_all() {
  awk -F '\t' '
    function short(list, n,   a, k, i, out) {
      k = split(list, a, ", "); out = ""
      for (i = 1; i <= k && i <= n; i++) out = out (i > 1 ? " " : "") a[i]
      return out (k > n ? " (+" k - n ")" : "")
    }
    $1 == "R" { if (!($2 in title)) { title[$2] = $3; ids[++n] = $2 }
                if ($4 != "-" && !(($2 SUBSEP $4) in sc)) { sc[$2 SUBSEP $4] = 1; chg[$2] = (chg[$2] ? chg[$2] ", " : "") $4 } }
    $1 == "T" { ref = $2; m = split($3, a, " "); for (i = 1; i <= m; i++) {
                  reqs_of[ref] = reqs_of[ref] " " a[i]
                  if (!((a[i] SUBSEP ref) in st)) { st[a[i] SUBSEP ref] = 1; tasks[a[i]] = (tasks[a[i]] ? tasks[a[i]] ", " : "") ref; nt[a[i]]++ } } }
    $1 == "C" { h = $2
                m = split($4, a, /[, ]+/); for (i = 1; i <= m; i++) if (a[i] != "") link(a[i], h)
                k = split($3, tk, /[, ]+/)
                for (j = 1; j <= k; j++) { p = split(reqs_of[tk[j]], b, " "); for (i = 1; i <= p; i++) link(b[i], h) } }
    function link(r, h) { if (!((r SUBSEP h) in sh)) { sh[r SUBSEP h] = 1; commits[r] = (commits[r] ? commits[r] ", " : "") h; nc[r]++ } }
    $1 == "P" { split($3, pp, "/"); key = $2 SUBSEP pp[1]; if (!(key in np)) { np[key] = 0; proj[$2] = (proj[$2] ? proj[$2] " " : "") pp[1] } np[key]++ ; nptot[$2]++ }
    END {
      for (x = 1; x <= n; x++) {
        id = ids[x]; t = title[id]; gsub(/\|/, "\\|", t)
        tp = ""; k = split(proj[id], a, " "); for (i = 1; i <= k; i++) tp = tp (i > 1 ? ", " : "") a[i] " " np[id SUBSEP a[i]]
        printf "%s\t| %s | %s | %s | %s | %s | %s |\n", id, id, t, (chg[id] ? chg[id] : "—"),
          (nt[id] ? nt[id] ": " short(tasks[id], 3) : "—"), (nc[id] ? nc[id] ": " short(commits[id], 3) : "—"), (tp ? tp : "—")
        if (!nt[id]) printf "GAP\t1\t%s\t%s\n", id, t
        if (!nc[id]) printf "GAP\t2\t%s\t%s\n", id, t
        if (!nptot[id]) printf "GAP\t3\t%s\t%s\n", id, t
      }
    }'
}

out=$(emit | join_all)

rows=$(printf '%s\n' "$out" | grep -v '^GAP' | sort -t "$(printf '\t')" -k1,1 | cut -f2-)
gaps=$(printf '%s\n' "$out" | grep '^GAP' | sort -t "$(printf '\t')" -k2,2n -k3,3 || true)
total=$(printf '%s\n' "$rows" | grep -c .)

echo "# Matriz de trazabilidad"
echo
echo "Generada con \`scripts/trace.sh\`: $total requisitos. Las columnas de tareas y commits muestran el total y los primeros; los commits son los que citan el ID en \`Refs:\` o los que ligan una tarea que lo nombra con \`Task:\`. En \`Pruebas\` se cuentan las pruebas cuyo título empieza con el ID, por proyecto."
echo
echo "| ID | Requisito | Change | Tareas | Commits | Pruebas |"
echo "|---|---|---|---|---|---|"
printf '%s\n' "$rows"
echo
echo "## Huecos"
echo

n_gaps=0
for kind in 1:"Requisitos sin tarea" 2:"Requisitos sin commit" 3:"Requisitos sin prueba cuyo título empiece con su ID"; do
  k=${kind%%:*}; label=${kind#*:}
  list=$(printf '%s\n' "$gaps" | awk -F '\t' -v k="$k" '$2 == k { printf "- `%s` %s\n", $3, $4 }')
  count=$(printf '%s\n' "$list" | grep -c . || true)
  n_gaps=$((n_gaps + count))
  echo "### $label ($count)"
  echo
  if [ "$count" -eq 0 ]; then echo "Ninguno."; else printf '%s\n' "$list"; fi
  echo
done

if [ "$check" -eq 1 ] && [ "$n_gaps" -gt 0 ]; then
  echo "trace.sh --check: $n_gaps huecos" >&2
  exit 1
fi
