# Quiz Card Generator (español)

Dado un documento fuente, genera cartas de prueba/memorización. Actualmente está diseñado específicamenta para **aprender idiomas**, así que el mejor material candidato para usar como entrada serán opciones como los siguientes, en el idioma destino:

- Guiones de películas
- Archivos de subtítulos
- Capítulos de libros
- Artículos de periódicos y revistas

[quizgen\_webui\_demo\_2024-02-11.fps-15](https://github.com/ogallagher/quizcard-generator/assets/17031438/dd0d440a-a198-428e-96ed-6a5f92b3ec1c)

## Instalación

Disponible como librería en [npm](https://npmjs.org).

```shell
npm install --global --omit dev quizcard-generator
# quizcard-generator ahora debe de estar disponible en la ruta de ejecución del usuario
quizcard-generator --help
```

### Descargar

Una alternativa es descargar y compilar el código fuente.

```shell
# descargar repo de código
git clone https://github.com/ogallagher/quizcard-generator

# instalar dependencias
npm install
# Hay también varias dependencias opcionales incluyendo yargs,
# la cual se requiere para ejecutar el generador como programa independiente/de entrada.
npm install yargs
```

### Compilar TypeScript y plantillas de cartas

El código se provee como archivos typescript, los cuales deben compilarse a javascript antes de ejecución

```shell
# typescript ya debe de estar instalada por paso anterior
# npm install typescript

npm run build
```

## Utilizar

Instrucciones a continuación suponen el uso del programa CLI, pero tal como se demostró en el video arriba, hay también una UI web en [wordsearch.dreamhosters.com/quizcard-generator](https://wordsearch.dreamhosters.com/quizcard-generator), que le da un interfaz encima del programa CLI.

Para ver todas las opciones disponibles, véase `node quizcard_generator.js --help` (o `quizcard-generator --help` si siguió las instrucciones para la instalación global desde NPM arriba).

### Documento fuente

Encuentre/cree y descargue un **documento fuente**. Solo el formato de texto simple `utf-8` se admite actualmente. Hay un par de ejemplos en `docs/examples/<lang>_source.txt`.

La ruta al documento se ingresa por `--input-file`.

### Exclusiones

Si uno sabe algunas palabras que no deben incluirse como vocabulario evaluable, se las puede especificar individualmente usando la opción `--exclude-word`, pero es más conveniente enumerarlas en una o más archivos de exclusiones, ingresando cada ruta al archivo de exclusiones por `--excludes-file`.

> Archivo de exclusiones ejemplar

```txt
# comentarios empiezan con '#' el inicio de la línea
cada
palabra
o
/reg(ular)?exp(ression)?/
# está en su propia línea
```

### Ejecutar Quiz Card Generator desde CLI

El `quizcard_generator.js` puede importarse tanto como correrse como programa de entrada. 

En el último case, la mayoría de la ejecución será canalizada por `quizcard_cli.js`, pero este segundo archivo no es de veras una envoltura; es una dependencia opcional usada para ejecución en cli. Admito que este flujo de control puede ser un tanto confuso.

> Ejecución de quiz card generator cli ejemplar

```shell
# compilación no necesaria a menos que archivos de fuente hayan cambiado desde la última compilación
npm run build

# ejecutar quiz card generator
node quizcard_generator.js \
# con archivo coreano de exclusiones ejemplar
--excludes-file "docs/examples/kor_source_excludes.txt" \
--input-file "docs/examples/kor_source.txt" \
# aquí especifico el nombre del resultado
--anki-notes-name kor-example-1 \
--log-level info
```

El singular archivo de resultado actualmente generado se encontrará en:

```txt
out/anki/notes/fill-blanks/<anki-notes-name>.txt
```

### Integraciones - Anki

Info de cartas de memoria generada debe importarse en [Anki](https://ankiweb.net) para ser usada.

El archivo de resultado de la ejecución del generador es un [archivo notas Anki](https://docs.ankiweb.net/importing/text-files.html), que va a requerir un par de pasos preparativos dentro de Anki para servir al importarse.

#### 1. Crear tipo de nota `fill-blanks` de tipo base `Cloze`

<img src="docs/img/tools_note-types.jpg" alt="herramientas &gt; gestionar tipos de nota"/>

<img src="docs/img/note-type_add.jpg" alt="gestionar tipos de nota &gt; agregar"/>

<img src="docs/img/add_cloze.jpg" alt="agregar tipo de nota de tipo base cloze"/>

El nombre de tipo de nota `fill-blanks` es el que las notas serán automaticamente asignadas al importarse, que mapea columnas a campos de nota.

#### 2. Definir campos que pertenecen al tipo de nota `fill-blanks`

<img src="docs/img/note-type_fields.jpg"/>

La orden de estos campos tiene que corresponder a la **orden** de columnas del archivo de notas generado por `quizcard-generator`:

- euid
- notetype _(campo meta, saltar)_
- tags _(campo meta, saltar)_
- text
- choices
- source-file
- source-line
- translations
- prologue
- epilogue

Los **nombres** son también importantes, con que serán referidos dentro de las plantillas de cartas usadas para generar cartas de memoria derivadas de las notas. Las opciones para cada campo mayormente no importan y son más relacionados a cómo se muestran en el navegador/buscador Anki.

<img src="docs/img/fill-blank_fields.jpg"/>

#### 3. Definir plantillas de carta que pertenecen al tipo de nota `fill-blanks`

<img src="docs/img/note-type_cards.jpg" alt="gestionar tipos de nota &gt; cartas (tipos de carta)">

Tal como se mencionó antes, las plantillas de cartas son cartas de memoria generadas de estas notas. Los cuerpos de archivos en `anki/card_templates/fill-blanks/` pueden pegarse directo a los 3 campos de texto correspondientes para definir plantillas de cartas.

- `front.html` &rarr; **Plantilla frente**
- `back.html` &rarr; **Plantilla dorso**
- `style.css` &rarr; **Estilos**

<img src="docs/img/fill-blank_card-templates.jpg" alt="editor de plantillas de carta fill-blanks">

#### 4. Importar archivo de notas a Anki

Por fin, vuelva a la ventana principal Anki y pulse **Importar archivo** para seleccionar el archivo generado por `quizcard-generator` (in el ejemplo de arriba, `out/anki/notes/fill-blanks/kor-example-1.txt`). No debe de ser necesary cambiar los ajustes por defecto.

<img src="docs/img/import_kor-example-1.jpg" alt="ventana de importar notas">

Después de importar, encuentre las notas importadas en el navegador Anki para confirmar que los campos se rellenaron correctamente. Luego, ¡échele vistazo a algunos adelantos de cartas!

<img src="docs/img/preview-card_kor-example-1_2.jpg" alt="">

Si quiere hacer modificaciones en masa en estas notas al paso de generar el archivo, se puede generar un archivo nuevo/sustituto en `out/anki/notes/fill-blanks/`, el cual contendrá las notas actualizadas. Cuando las notas actuales se importan en Anki, son identificadas únicamente por la columna `euid`, que no cambiará mientras que el nombre de archivo de entrada/fuente dado a `quizcard-generator` y el número de línea al que pertenece la nota no cambian. Notas ya dentro de Anki según `euid` serán entonces sobreescritas en lugar de crear réplicas.

#### Etiquetas de control de renderizado

Las etiquetas son un concepto organizacional ya presente en Anki, y el generador de cartas de memoria (quizgen) las incluye en sus notas generadas para luego poder aislar notas con rapidez dentro de Anki que llegaron desde quizgen, y entre ellas de cuáles textos fuentes son. Sin embargo, además de etiquetas de organizar, quizgen también emplea etiquetas de control de renderizado.

Etiquetas de control de renderizado sirven como opciones dinámicas para cambiar cómo las cartas de una nota se renderizan/muestran. Abajo está una lista de etiquetas de control vigentes. Son todas incluídas por defecto en las notas generadas, a menos que se especifica de otra manera abajo. Consulte los comentarios jsdoc en [`anki/anki_tag.ts:RenderControlTag`](https://github.com/ogallagher/quizcard-generator/blob/main/anki/anki_tag.ts) a ver detalles actuales.

- `qg-show-logging` Renderizar mensajes de depuración en una caja de texto cerca del pie de la carta. **No incluída** por defecto. Si quere ver mensajes de depuración, puede incluir esta etiqueta en las opciones del programa, o agregar la etiqueta dentro de Anki después de importar.
- `qg-show-choices` Mostrar las respuestas múltiples para la palabra evaluada.
- `qg-show-source-file` Mostrar el archivo fuente de la nota.
- `qg-show-source-line` Mostrar el número de línea en su archivo fuente.
- `qg-show-randomized` Barajear aleatoriamente las respuestas al renderizar.
- `qg-show-prologue` Mostrar texto anterior a la nota del documento fuente.
- `qg-show-epilogue` Mostrar texto posterior a la nota del documento fuente.
