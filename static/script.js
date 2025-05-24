const dropZone = document.getElementById('drag-and-drop-zone');
const textBlock = dropZone.querySelector('.drop-zone-text');
const previewBlock = dropZone.querySelector('.drop-zone-preview');
let fileInput = dropZone.querySelector('input[type="file"]');
const outputDiv = document.querySelector('.text-output');


const selectFolderBtn = document.getElementById('select-folder-btn');
const folderInput = document.getElementById('folder-input');
const folderStructure = document.getElementById('folder-structure');
const folderPanel = document.getElementById('folder-panel');

let filesMap = new Map();  // key: file path, value: File object
let draggedFile = null;
let selectionMode = false; //Флаг выделения области
let selectedAreas = []; // [{coords: {...}, type: "1"}, ...]
let coordsOfAreas = []; // [{coords: {...}, type: "1"}, ...]
let displayWidth = 1;
let displayHeight = 1;
let imgElem = previewBlock.querySelector('img');
// let scale = 1;
let scale;
let currentSelection = null; // Текущее выделение в процессе
let scrolledToEnd = false;
let isResponse = false; //Флаг получения ответа
let contentMaxWidth = 1540;
let isDeletionMode = false; //Флаг удаления области
let result;
let path;
let imageName;
let fromFolder = false;
let realWidth;
let realHeight;

const classColors = {
    1:  "#0e00fb",
    2:  "#01fb02",
    3:  "#fc0001",
    4:  "#0afdfc",
    5:  "#ff00ff",
    6:  "#fffd02",
    7:  "#0082ff",
    8:  "#fd037e",
    9:  "#fe7e07",
    10: "#7c80f7",
    11: "#8ef886",
    12: "#fd817f",
    13: "#7dfefe"
};

const typeNames = {
    1: "Пора",
    2: "Включение",
    3: "Подрез",
    4: "Прожог",
    5: "Трещина",
    6: "Наплыв",
    7: "Эталон1",
    8: "Эталон2",
    9: "Эталон3",
    10: "Пора-скрытая",
    11: "Утяжина",
    12: "Несплавление",
    13: "Непровар корня"
};



// Функция для динамического изменения margin у body
function setBodyMargins() {
    const viewportWidth = document.documentElement.clientWidth;
    if (viewportWidth < 1679) {
        contentMaxWidth = 1340;
    }
    else if (viewportWidth > 2300) {
        contentMaxWidth = 2040;
    }
    else if (viewportWidth > 3500) {
        contentMaxWidth = 2540;
    }
    const margin = Math.max((viewportWidth - contentMaxWidth) / 2, 0);
    document.body.style.marginLeft = margin + 'px';
    document.body.style.marginRight = margin + 'px';
}


// Запуск при загрузке страницы
window.addEventListener('load', setBodyMargins);
// Обновление при изменении размера окна
window.addEventListener('resize', setBodyMargins);


// === Дроп-зона ===
dropZone.addEventListener('click', (e) => {
    // Если режим выделения включен, игнорируем клик
    if (selectionMode) return;

    // Если клик был по canvas, игнорируем (на всякий случай)
    if (e.target.tagName === 'CANVAS') return;

    fileInput.click();
});


dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
});


dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('dragover');
});


function showLoading(flag = 0) {
    textBlock.style.display = 'flex';
    if (flag === 1) {
        textBlock.innerHTML = `
        <span class="drop-zone-spinner"></span>
        <span>Загрузка результатов обработки...</span>
         `;
    } else {
        textBlock.innerHTML = `
        <span class="drop-zone-spinner"></span>
        <span>Загрузка изображения...</span>
         `;
    }
    previewBlock.style.display = 'none';
    previewBlock.innerHTML = '';
}


const deleteImageBtn = document.getElementById('delete-image-btn');
const confirmDefectBtn = document.getElementById('confirm-defects-btn');
const deleteAreaBtn = document.getElementById('delete-area-btn');
const downloadBtn = document.getElementById('download-btn');
const confirmBtn = document.getElementById('confirm-btn');


function clearPreview() {
    selectedAreas = [];
    coordsOfAreas = [];
    document.querySelector('.text-output').textContent = '';

    selectionMode = false;

    previewBlock.innerHTML = '';
    activateSelectionBtn.disabled = true;
    deleteImageBtn.disabled = true;
    confirmDefectBtn.disabled = true;
    deleteAreaBtn.disabled = true;
    downloadBtn.style.visibility = 'hidden';
    confirmBtn.disabled = true;
    textBlock.style.display = 'flex';
    textBlock.textContent = 'Кликните или перетащите изображение сюда';
    document.getElementById('output').textContent = '';
    fileInput.value = '';

    selectionMode = false;
    isSelecting = false;
    selStartX = selStartY = selEndX = selEndY = 0;

    // Удаление canvas, если существует
    if (selectionCanvas && selectionCanvas.parentNode) {
        selectionCanvas.parentNode.removeChild(selectionCanvas);
    }

    document.querySelectorAll('input[name="defect-type"]').forEach(radio => {
        radio.checked = false;
    });

    document.getElementById('non-vis').classList.add('hidden');

    document.getElementById('output').textContent = 'Результаты обработки';

}


deleteImageBtn.addEventListener('click', clearPreview);


function showImagePreview(src) {
    textBlock.style.display = 'none';
    previewBlock.style.display = 'block';
    previewBlock.innerHTML = `<img src="${src}" alt="preview" />`;

    imgElem = previewBlock.querySelector('img');
    imgElem.onload = () => {
        // Вычисляем размеры для canvas
        displayHeight = previewBlock.clientHeight;
        scale = displayHeight / imgElem.naturalHeight;
        displayWidth = imgElem.naturalWidth * scale;

        activateSelectionBtn.disabled = true;
        deleteImageBtn.disabled = false;
        confirmDefectBtn.disabled = false;
        downloadBtn.style.visibility = 'hidden';
        deleteAreaBtn.disabled = true;
        confirmBtn.disabled = false;

        if (isResponse){
            confirmBtn.disabled = true;
            activateSelectionBtn.disabled = false;
            deleteAreaBtn.disabled = false;
            deleteImageBtn.disabled = true;
            // downloadBtn.style.visibility = 'hidden';
        }

        // confirmBtn.disabled = false;
        scrolledToEnd = false;

        if (isResponse) {
            document.getElementById('non-vis').classList.remove('hidden');
        }
    };

}


dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');

    // Обработка файла из структуры папок
    if (draggedFile) {
        if (draggedFile.type.startsWith('image/')) {
            imageName = draggedFile.name;
            console.log(imageName);
            showLoading();
            const reader = new FileReader();
            reader.onload = (event) => {
            const img = new Image();
                img.onload = function() {
                    realHeight = this.height;
                    realWidth = this.width;
                    console.log('Размеры:', this.width, this.height);
                };
                path = event.target.result;
                showImagePreview(event.target.result);
            };
            reader.readAsDataURL(draggedFile);
        } else {
            alert('Можно перетаскивать только изображения!');
        }
        draggedFile = null;
        return;
    }

    // Обработка внешних файлов
    const files = e.dataTransfer.files;
    if (files.length) {
        const file = files[0];
        imageName = file.name;
        console.log(imageName);
        if (file.type.startsWith('image/')) {
            showLoading();
            const reader = new FileReader();
             reader.onload = (event) => {
                const img = new Image();
                img.onload = function() {
                    realHeight = this.height;
                    realWidth = this.width;
                    console.log('Размеры:', this.width, this.height);
                };
                path = event.target.result;
                showImagePreview(event.target.result);
            };
            reader.readAsDataURL(file);
        } else {
            alert('Пожалуйста, загрузите изображение.');
        }
    }
});


fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    if (file && file.type.startsWith('image/')) {
        imageName = file.name;
        console.log(imageName);
        showLoading();

        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = function() {
                realHeight = this.height;
                realWidth = this.width;
                console.log('Размеры:', this.width, this.height);
            };
            img.src = event.target.result; // Важно! Присваиваем src
            path = event.target.result;
            showImagePreview(event.target.result);
        };
        reader.readAsDataURL(file);
    }
});


// === Обработка выбора папки слева ===
selectFolderBtn.addEventListener('click', () => {
    folderInput.click();
});


folderInput.addEventListener('change', () => {
    const files = Array.from(folderInput.files);
    filesMap.clear();

    if (files.length === 0) {
        folderStructure.textContent = 'Папка не выбрана';
        return;
    }

    // Получаем имя корневой папки
    const firstPath = files[0].webkitRelativePath || files[0].name;
    const rootFolder = firstPath.split('/')[0];

    // Сохраняем все файлы в Map
    files.forEach(file => {
        const path = file.webkitRelativePath || file.name;
        filesMap.set(path, file);
    });

    // Очищаем структуру
    folderStructure.innerHTML = '';

    // Добавляем название выбранной папки сверху
    const folderTitle = document.createElement('div');
    folderTitle.textContent = rootFolder;
    folderTitle.className = 'folder-root-title';
    folderStructure.appendChild(folderTitle);

    // Фильтруем файлы, чтобы не включать корневую папку в дерево
    const tree = buildDraggableTree(files, rootFolder);
    folderStructure.appendChild(tree);
});

// === Функция построения дерева с drag-and-drop ===
function buildDraggableTree(files, rootFolder) {
    const root = document.createElement('ul');
    root.style.listStyle = 'none';
    root.style.paddingLeft = '20px';

    const structure = {};

    // Строим древовидную структуру, начиная после корня
    files.forEach(file => {
        let path = file.webkitRelativePath.split('/');
        if (path[0] === rootFolder) path = path.slice(1); // убираем корень

        let currentLevel = structure;

        path.forEach((part, index) => {
            if (!currentLevel[part]) {
                currentLevel[part] = {
                    element: document.createElement('li'),
                    children: {},
                    isFile: index === path.length - 1
                };

                const li = currentLevel[part].element;
                li.textContent = '';

                if (index !== path.length - 1) {
                    li.classList.add('folder-item');
                    const img = document.createElement('img');
                    img.src = '/static/src/folder-closed.png';
                    img.alt = 'folder';
                    img.style.width = '16px';
                    img.style.height = '16px';
                    img.style.verticalAlign = 'middle';
                    img.style.marginRight = '6px';
                    li.appendChild(img);
                }

                li.appendChild(document.createTextNode(part));

                if (index === path.length - 1) {
                    li.draggable = true;
                    li.style.cursor = 'grab';
                    li.addEventListener('dragstart', (e) => {
                        draggedFile = file;
                        fileInput = draggedFile;
                        fromFolder = true;
                        e.dataTransfer.effectAllowed = 'copy';
                        e.dataTransfer.setData('text/plain', file.name);
                    });
                }
            }
            currentLevel = currentLevel[part].children;
        });
    });

    // Рекурсивно добавляем элементы в DOM
    function addToDOM(structure, parent) {
        Object.entries(structure).forEach(([, node]) => { //тут было name 1 арг
            const ul = document.createElement('ul');
            ul.style.paddingLeft = '20px';
            ul.style.listStyle = 'none';

            parent.appendChild(node.element);
            if (Object.keys(node.children).length > 0) {
                node.element.appendChild(ul);
                addToDOM(node.children, ul);
            }
        });
    }

    addToDOM(structure, root);
    return root;
}


confirmBtn.addEventListener('click', () => {
    //отправка на сервер изображения, в 1 раз пустого, во 2 раз координаты ОКРУГЛИТЬ
    let file;
    if (!isResponse) {
        if (fromFolder){
            file = fileInput;
        } else {
            file = fileInput.files[0];
        }
        sendImage(file);
        // activateSelectionBtn.disabled = false;
        // deleteAreaBtn.disabled = false;
        // deleteImageBtn.disabled = true;
    } else {
        activateSelectionBtn.disabled = true;
        deleteAreaBtn.disabled = true;
        deleteImageBtn.disabled = false;
        confirmBtn.disabled = true;
        fromFolder = false;
        selectionMode = false;
        isResponse = false;
        // downloadBtn.disabled = false;
        downloadBtn.style.visibility = 'visible';
        folderPanel.classList.remove('disabled-div');
        confirmBtn.textContent = "Отправить изображение";
    }
});


async function sendImage(file) {
    try {
        const formData = new FormData();
        formData.append("file", file);
        showLoading(1);

        const response = await fetch("/upload-image", {
            method: "POST",
            body: formData,
            credentials: "include", // чтобы куки userId отправлялись
            signal: AbortSignal.timeout(600000)
        });

        if (!response.ok) {
            throw new Error('Отправка не прошла: ' + response.statusText);
        }

        isResponse = true;
        confirmBtn.disabled = true;

        await new Promise(resolve => setTimeout(resolve, 0));

        result = await response.json();
        console.log(result); // {status: "ok", filename: "...", size: ...}

        activateSelectionBtn.disabled = false;
        deleteAreaBtn.disabled = false;
        deleteImageBtn.disabled = true;
        folderPanel.classList.add('disabled-div');

        hideLoading();

        showImagePreview(path);
        initSelectionCanvas(imgElem, displayWidth, displayHeight);


        console.log("Отрисовка при получении изображения")
        drawPolygonsOnCanvas(result, selectionCtx);
        confirmBtn.textContent = "Подтвердите корректность";

        updateTypeCountDisplay()

        return result;
    } catch (error) {
        clearPreview();
        console.error('Ошибка при отправке изображения:', error);
        alert('Отправка не прошла. Пожалуйста, попробуйте еще раз.');
        throw error; // если нужно обработать ошибку выше по стеку
    }
}

function hideLoading() {
    textBlock.style.display = 'none';
    previewBlock.style.display = 'block'; // Показываем блок с результатами
}


dropZone.addEventListener('scroll', () => {
    // Максимальный сдвиг прокрутки по горизонтали
    const maxScrollLeft = dropZone.scrollWidth - dropZone.clientWidth;

    // Проверяем, дошёл ли скролл до конца (с учётом небольшого запаса)
    if (!scrolledToEnd && isResponse && dropZone.scrollLeft >= maxScrollLeft - 1) {
        confirmBtn.disabled = false;
        scrolledToEnd = true;
    }
});


// === Добавляем выделение области на изображении ===
let selectionCanvas, selectionCtx;
let isSelecting = false;
let selStartX = 0, selStartY = 0, selEndX = 0, selEndY = 0;
let originalRadioGroupDisplay = '';


// Модифицируем обработчик кнопки удаления
deleteAreaBtn.addEventListener('click', () => {
    // Активируем режим удаления
    isDeletionMode = true;
    selectionMode = false;

    // Скрываем радиогруппу и сбрасываем выбор
    const radioGroup = document.querySelector('.radio-group');
    originalRadioGroupDisplay = radioGroup.style.display;
    radioGroup.style.display = 'none';
    document.querySelectorAll('input[name="defect-type"]').forEach(radio => {
        radio.checked = false;
    });

    // Блокируем/разблокируем кнопки
    deleteAreaBtn.disabled = true;
    activateSelectionBtn.disabled = false;

    // Перерисовываем существующие области
    //drawAllSelections();
});


const activateSelectionBtn = document.getElementById('activate-selection-btn');
activateSelectionBtn.addEventListener('click', () => {
    selectionMode = true;
    isDeletionMode = false;

    // initSelectionCanvas(imgElem, displayWidth, displayHeight, scale);
    activateSelectionBtn.disabled = true; // (опционально) блокируем кнопку, пока режим активен

    // deleteAreaBtn.disabled = !coordsOfAreas || coordsOfAreas.length === 0;
    // deleteAreaBtn.disabled = !selectedAreas || selectedAreas.length === 0;
    deleteAreaBtn.disabled = !selectedAreas || result.length === 0;

    const radioGroup = document.querySelector('.radio-group');
    radioGroup.style.display = '';
});


function drawAllSelections() {


    drawPolygonsOnCanvas(result, selectionCtx);


    // Рисуем все сохраненные области
    selectedAreas.forEach(area => {
        drawSelectionArea(area);
    });

    // Рисуем текущее выделение (если есть)
    if (currentSelection) {
        drawSelectionArea(currentSelection, true);
    }
}


function drawSelectionArea(area, isTemporary = false) {
    selectionCtx.setLineDash([6, 3]);
    selectionCtx.strokeStyle = isTemporary ? 'red' : 'lime';
    selectionCtx.lineWidth = 2;

    const x = area.leftTop.x * scale;
    const y = area.leftTop.y * scale;
    const w = (area.rightBottom.x - area.leftTop.x) * scale;
    const h = (area.rightBottom.y - area.leftTop.y) * scale;

    selectionCtx.strokeRect(x, y, w, h);

    if (!(x === x+w && y === y+h)) {
        // Рисуем номер типа
        if (area.type) {
            selectionCtx.setLineDash([]); // Убираем пунктир для текста
            // selectionCtx.font = 'bold 18px Arial, sans-serif';
            selectionCtx.font = 'bold 16px Arial';
            selectionCtx.lineWidth = 3;
            selectionCtx.strokeStyle = 'black';
            selectionCtx.fillStyle = isTemporary ? 'red' : '#0079c3';
            selectionCtx.textBaseline = 'top';

            selectionCtx.strokeText(area.type, x + 5, y - 16);
            selectionCtx.fillText(area.type, x + 5, y - 16);
        }

    }
    updateTypeCountDisplay();
}


function drawSelection() {
    selectionCtx.clearRect(0, 0, selectionCanvas.width, selectionCanvas.height);
    if (!isSelecting && selStartX === selEndX && selStartY === selEndY) return;
    selectionCtx.setLineDash([6, 3]);
    selectionCtx.strokeStyle = 'red';
    selectionCtx.lineWidth = 2;
    const x = Math.min(selStartX, selEndX);
    const y = Math.min(selStartY, selEndY);
    const w = Math.abs(selEndX - selStartX);
    const h = Math.abs(selEndY - selStartY);
    selectionCtx.strokeRect(x, y, w, h)
}


function showSelectionCoords() {
    const x = Math.min(selStartX, selEndX);
    const y = Math.min(selStartY, selEndY);
    const w = Math.abs(selEndX - selStartX);
    const h = Math.abs(selEndY - selStartY);
    if (w > 0 && h > 0) {
        // Переводим к оригинальным координатам
        const origX = Math.round(x / scale);
        const origY = Math.round(y / scale);
        const origW = Math.round(w / scale);
        const origH = Math.round(h / scale);
        document.getElementById('output').textContent =
            `Выделено: x=${origX}, y=${origY}, ширина=${origW}, высота=${origH}`;
    } else {
        document.getElementById('output').textContent = '';
    }
}


// ======== Обработчики режима выделения ========
activateSelectionBtn.addEventListener('click', () => {
    selectionMode = true;
    activateSelectionBtn.disabled = true;
    dropZone.style.cursor = 'crosshair';
    // drawPolygonsOnCanvas(result, selectionCtx);
});


// ======== Модифицированная функция initSelectionCanvas ========
function initSelectionCanvas(imgElem, displayWidth, displayHeight) {
    // Удаляем старый canvas
    console.log("Параметры создания canvas")

    if (selectionCanvas && selectionCanvas.parentNode) {
        selectionCanvas.parentNode.removeChild(selectionCanvas);
    }

    // Создаем новый canvas
    selectionCanvas = document.createElement('canvas');
    selectionCanvas.id = 'selection-canvas';
    selectionCanvas.width = displayWidth;
    selectionCanvas.height = displayHeight;
    selectionCanvas.style.cssText = `
        position: absolute;
        left: 0;
        top: 0;
        width: ${displayWidth}px;
        height: ${displayHeight}px;
        cursor: crosshair;
        z-index: 2;
    `;
    selectionCtx = selectionCanvas.getContext('2d');
    selectionCtx.clearRect(0, 0, selectionCanvas.width, selectionCanvas.height);
    // Вставляем canvas после изображения
    imgElem.insertAdjacentElement('afterend', selectionCanvas);

    // Обработчики событий
    const getMousePos = (e) => {
        const rect = selectionCanvas.getBoundingClientRect();
        return {
            x: Math.round((e.clientX - rect.left) * (selectionCanvas.width / rect.width)),
            y: Math.round((e.clientY - rect.top) * (selectionCanvas.height / rect.height))
        };
    };


    selectionCanvas.addEventListener('mousedown', e => {
        const checkedRadio = document.querySelector('input[name="defect-type"]:checked');
        if (!checkedRadio && !isDeletionMode) {
            alert('Выберите тип области!');
            return;
        }

        isSelecting = true;
        const pos = getMousePos(e);

        if (!isDeletionMode) {
            currentSelection = {
                leftTop: { x: pos.x / scale, y: pos.y / scale },
                rightBottom: { x: pos.x / scale, y: pos.y / scale },
                type: checkedRadio.value
            };
        }else{
            currentSelection = {
                leftTop: { x: pos.x / scale, y: pos.y / scale },
                rightBottom: { x: pos.x / scale, y: pos.y / scale }
            };
        }
    });


    selectionCanvas.addEventListener('mousemove', e => {
        if (!isSelecting) return;
        const pos = getMousePos(e);
        currentSelection.rightBottom = {
            x: pos.x / scale,
            y: pos.y / scale
        };
        drawAllSelections();
    });


    selectionCanvas.addEventListener('mouseout', function(e) {
        if (!isSelecting) return;
        isSelecting = false;
    });

    selectionCanvas.addEventListener('mouseup', e => {
        if (!isSelecting) return;
        isSelecting = false;

        // Фиксируем выделение
        //selectedAreas.push({ ...currentSelection });
        //drawAllSelections();

        const pos = getMousePos(e);
        selEndX = pos.x;
        selEndY = pos.y;

        const x1 = Math.min(currentSelection.leftTop.x, selEndX / scale);
        const y1 = Math.min(currentSelection.leftTop.y, selEndY / scale);
        const x2 = Math.max(currentSelection.leftTop.x, selEndX / scale);
        const y2 = Math.max(currentSelection.leftTop.y, selEndY / scale);

        // const origX1 = Math.round(x1);
        // const origY1 = Math.round(y1);
        // const origX2 = Math.round(x2);
        // const origY2 = Math.round(y2);

        const origX1 = x1;
        const origY1 = y1;
        const origX2 = x2;
        const origY2 = y2;

        // --- Получаем выбранный тип области ---
        const checkedRadio = document.querySelector('input[name="defect-type"]:checked');
        const defectType = checkedRadio ? checkedRadio.value : null


        // --- Сохраняем в массив ---
        if (!(origX1 === origX2 && origY1 === origY2) && selectionMode){
            coordsOfAreas.push({
                coords: {
                    leftTop: {x: origX1, y: origY1},
                    rightTop: {x: origX2, y: origY1},
                    rightBottom: {x: origX2, y: origY2},
                    leftBottom: {x: origX1, y: origY2}
                },
                type: defectType
            });
        }

        // deleteAreaBtn.disabled = !selectedAreas || selectedAreas.length === 0;
        deleteAreaBtn.disabled = !selectedAreas || result.length === 0;
        if (isDeletionMode){
            deleteAreaBtn.disabled = true;
        }

        // Удаление области
        if (isDeletionMode) {

            let popElem = currentSelection;


            const x1 = Math.min(popElem.leftTop.x, selEndX / scale);
            const y1 = Math.min(popElem.leftTop.y, selEndY / scale);
            const x2 = Math.max(popElem.leftTop.x, selEndX / scale);
            const y2 = Math.max(popElem.leftTop.y, selEndY / scale);

            let tempRes = result.filter(data => {
                return NoIntersections(data, x1, x2, y1, y2)
            });

            const countRes = result.length;
            const countTempRes = tempRes.length;
            if (countRes !== countTempRes) {
                const result1 = window.confirm("Удалить выбранную область?");
                if (result1) {
                    result = tempRes
                }
            }

        }

        if(!isDeletionMode) {
            addNewPolygons(origX1, origY1, origX2, origY2, defectType);
        }


        currentSelection = null;
        drawAllSelections();
        updateTypeCountDisplay();
    });

    selectionCanvas.addEventListener('mouseleave', () => {
        // if (isSelecting) {
        //     isSelecting = false;
        //     console.log("MouseLeave")
        //     drawSelection();
        //     showSelectionCoords();
        // }
        if (!isSelecting) return;
        isSelecting = false;
        drawSelection();
        showSelectionCoords();
    });

    selectionCanvas.addEventListener('dblclick', () => {
        //selectionCtx.clearRect(0, 0, selectionCanvas.width, selectionCanvas.height);
        //document.getElementById('output').textContent = '';
    });
}


function updateTypeCountDisplay() {
    outputDiv.innerHTML = '';
    const typeCounts = {};
    for (let i = 1; i <= 13; i++) {
        typeCounts[i] = 0;
    }
    result.forEach(area => {
        const type = area.class || area.type;
        if (typeCounts.hasOwnProperty(type)) {
            typeCounts[type]++;
        }
    });

    // outputDiv.innerHTML = Object.entries(typeCounts)
    //     .map(([type, count]) =>
    //         `<div><b>${typeNames[type] || "Неизвестно"}:</b> ${count} шт.</div>`
    //     )
    //     .join('');

    outputDiv.innerHTML = Object.entries(typeCounts)
        .map(([type, count], idx) => {
            const number = idx + 1;
            const space = number <= 9 ? '&nbsp;&nbsp;' : '';
            return `
            <div style="display: flex; align-items: center; margin-bottom: 4px;">
                <span style="margin-right: 6px;">${space}${number}.</span>
                <span style="
                    display: inline-block;
                    width: 16px;
                    height: 16px;
                    border-radius: 50%;
                    background: ${classColors[type] || '#ccc'};
                    margin-right: 8px;
                    border: 1px solid #888;
                "></span>
                <b>${typeNames[type] || "Неизвестно"}:</b>&nbsp;${count} шт.
            </div>`;
        })
        .join('');


}


// Функция проверки отсутствия пересечения
function areRectanglesNotIntersecting(rect1, rect2) {
    const w1 = rect1.x2 - rect1.x1;
    const w2 = rect2.x2 - rect2.x1;
    const h1 = rect1.y2 - rect1.y1;
    const h2 = rect2.y2 - rect2.y1;

    return (
        (rect1.x1 > (rect2.x1 + w2) || (rect2.x1 > (rect1.x1 + w1)) ||
            (rect1.y1 > (rect2.y1 + h2)) || (rect2.y1 > (rect1.y1 + h1)))
    );
}


//ТЕСТОВАЯ ФУНКЦИЯ ДЛЯ ОТЛАДКИ СОЗДАНИЯ ОТЧЕТА (РАБОЧАЯ)
async function sendJsonAndGetDocx(jsonData) {
    try {
        jsonData = {"image_name": imageName, "data": jsonData}
        const response = await fetch("/generate-docx", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(jsonData),
            credentials: "include" // чтобы куки userId отправлялись
        });

        if (!response.ok) {
            throw new Error('Ошибка генерации файла: ' + response.statusText);
        }

        // Получаем файл как Blob
        const blob = await response.blob();

        // Создаем ссылку для скачивания файла
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = "result.docx"; // Можно задать любое имя файла
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);

        return true; // или можно вернуть blob, если нужно
    } catch (error) {
        console.error('Ошибка при получении файла:', error);
        alert('Не удалось получить файл. Пожалуйста, попробуйте еще раз.');
        throw error;
    }
}


function drawPolygonsOnCanvas(data, ctx) {
        ctx.clearRect(0, 0, selectionCanvas.width, selectionCanvas.height);// очистка, если нужно
        ctx.setLineDash([]); // Сплошная линия
        ctx.lineWidth = 2;
        ctx.font = 'bold 16px Arial';
        ctx.globalAlpha = 1.0; // сброс прозрачности
        ctx.strokeStyle = '#000000'; // базовый цвет обводки
        ctx.fillStyle = '#000000'; // базовый цвет заливки
        ctx.textBaseline = 'alphabetic';
        ctx.globalCompositeOperation = 'source-over';
        ctx.shadowColor = 'rgba(0,0,0,0)';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
        data.forEach(obj => {
        // Преобразуем массив чисел в массив точек {x, y}
        const rawPoints = obj.polygon;
        const points = convertPolygonPoints(rawPoints);

        if (points.length === 0) return;

        // Получаем размеры canvas
        const canvasWidth = selectionCanvas.width;
        const canvasHeight = selectionCanvas.height;

        ctx.beginPath();

        // Масштабируем первую точку
        const startX = points[0].x * canvasWidth;
        const startY = points[0].y * canvasHeight;
        ctx.moveTo(startX, startY);

        // Масштабируем и рисуем остальные точки
        for (let i = 1; i < points.length; i++) {
            const scaledX = points[i].x * canvasWidth;
            const scaledY = points[i].y * canvasHeight;
            ctx.lineTo(scaledX, scaledY);
        }

        ctx.closePath();
        // ctx.strokeStyle = 'red';
        const strokeColor = classColors[obj.class] || "#ffffff"; // Добавлен #
        const fillColor = classColors[obj.class] || "#ffffff";   // Добавлен #

        ctx.strokeStyle = strokeColor; // Задаём цвет контура
        ctx.fillStyle = hexToRgba(fillColor, 0.2); // Задаём цвет заливки
        ctx.lineWidth = 2;

        ctx.stroke();
        ctx.fill();

        // --- Вывод номера класса рядом с областью ---
        const textX = startX + 5; // смещение вправо
        const textY = startY - 5; // смещение вверх

        ctx.font = 'bold 16px Arial';
        ctx.lineWidth = 3;
        ctx.strokeStyle = 'black'; // обводка для читаемости
        ctx.strokeText(obj.class.toString(), textX, textY);
        ctx.fillStyle = strokeColor; // основной цвет текста
        ctx.fillText(obj.class.toString(), textX, textY);

        // // Рисуем точки
        // points.forEach(pt => {
        //     const x = Math.round(pt.x * canvasWidth * scale); // Округление для чёткого пикселя
        //     const y = Math.round(pt.y * canvasHeight * scale);
        //
        //     ctx.fillStyle = 'rgba(0, 0, 255, 0.5)'; // Синий с прозрачностью 50%
        //     ctx.fillRect(x, y, 1, 1); // Квадрат 1x1 пиксель
        // });

    });
}


// Вспомогательная функция для перевода hex в rgba с прозрачностью
function hexToRgba(hex, alpha) {
    // Удаляем # если есть
    hex = hex.replace('#', '');
    // Парсим r, g, b
    const bigint = parseInt(hex, 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    return `rgba(${r},${g},${b},${alpha})`;
}


// Функция для преобразования массива чисел в массив точек
function convertPolygonPoints(rawPoints) {
    if (rawPoints.length % 2 !== 0) {
        console.error("Некорректное количество координат");
        return [];
    }

    const points = [];
    for (let i = 0; i < rawPoints.length; i += 2) {
        points.push({
            x: rawPoints[i],
            y: rawPoints[i + 1]
        });
    }
    return points;
}

function addNewPolygons(X1, Y1, X2, Y2, type) {
    let width = realWidth;
    let height = realHeight;
    X1 = X1 / width;
    X2 = X2 / width;
    Y1 = Y1 / height;
    Y2 = Y2 / height;
    let res = {
            class:  Number(type),
            polygon: [X1, Y1, X2, Y1, X2, Y2, X1, Y2]
    };
        result.push(res)
}

function NoIntersections(obj, x1, x2, y1, y2, scale = 1){
    // Преобразуем массив чисел в массив точек {x, y}
    const rawPoints = obj.polygon;
    const points = convertPolygonPoints(rawPoints);

    if (points.length === 0) return true;

    // Получаем размеры canvas
    const canvasWidth = selectionCanvas.width;
    const canvasHeight = selectionCanvas.height;

    let min_X = points[0].x * realWidth;
    let max_X = points[0].x * realWidth;
    let min_Y = points[0].y * realHeight;
    let max_Y = points[0].y * realHeight;


    for (let i = 1; i < points.length; i++) {
        const scaledX = points[i].x * realWidth;
        const scaledY = points[i].y * realHeight;
        min_X = Math.min(min_X, scaledX);
        max_X = Math.max(max_X, scaledX);
        min_Y = Math.min(min_Y,scaledY)
        max_Y = Math.max(max_Y, scaledY)
    }


    let temp1 = {x1: x1, x2: x2, y1: y1, y2: y2}
    let temp2 = {x1: min_X, x2: max_X,y1: min_Y, y2: max_Y}


    return  areRectanglesNotIntersecting(temp1, temp2)
}


downloadBtn.addEventListener('click', () => {
    sendJsonAndGetDocx(result);
});