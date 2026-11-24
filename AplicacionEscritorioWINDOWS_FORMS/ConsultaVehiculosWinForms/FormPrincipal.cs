
using System;
using System.Collections.Generic;
using System.Data;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Globalization;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using System.Windows.Forms;

namespace ConsultaVehiculosWinForms;

public partial class FormPrincipal : Form
{
    private static readonly Color Azul = Color.FromArgb(25, 58, 113);
    private static readonly Color AzulClaro = Color.FromArgb(42, 104, 190);
    private static readonly Color Fondo = Color.FromArgb(242, 246, 251);
    private static readonly Color Texto = Color.FromArgb(43, 55, 73);
    private static readonly Color Gris = Color.FromArgb(111, 124, 143);
    private static readonly Color Verde = Color.FromArgb(29, 132, 91);
    private static readonly Color Rojo = Color.FromArgb(185, 58, 58);

    // Prefijo ui para evitar conflictos con FormPrincipal.Designer.cs.
    private readonly TextBox uiJwt = new()
    {
        Dock = DockStyle.Fill,
        UseSystemPasswordChar = true,
        Font = new Font("Consolas", 10),
        Margin = new Padding(4, 5, 4, 5)
    };

    private readonly Label uiJwtIndicador = new()
    {
        Text = "Sin token",
        AutoSize = true,
        ForeColor = Gris
    };

    private readonly Label uiEstado = new()
    {
        Dock = DockStyle.Fill,
        Text = "Sistema listo",
        TextAlign = ContentAlignment.MiddleLeft,
        AutoEllipsis = true,
        ForeColor = Texto
    };

    private readonly ProgressBar uiProgreso = new()
    {
        Dock = DockStyle.Fill,
        Style = ProgressBarStyle.Marquee,
        MarqueeAnimationSpeed = 25,
        Visible = false
    };

    private readonly Dictionary<string, TextBox> camposVehiculo = new();
    private readonly Dictionary<string, TextBox> camposComprador = new();

    private readonly VistaListado vistaVehiculos = new("vehículos");
    private readonly VistaListado vistaCompradores = new("compradores");
    private readonly VistaListado vistaVentas = new("ventas");

    private readonly GraficoVentas graficoVentas = new();

    private Panel? cabecera;

    private string cantidadVehiculos = "—";
    private string cantidadCompradores = "—";
    private string cantidadVentas = "—";

    public FormPrincipal()
    {
        InitializeComponent();

        SuspendLayout();
        Controls.Clear();

        Text = "Administración de Vehículos | APE 04";
        StartPosition = FormStartPosition.CenterScreen;
        Size = new Size(1320, 850);
        MinimumSize = new Size(1050, 700);
        BackColor = Fondo;
        Font = new Font("Segoe UI", 9.5f);

        ConstruirInterfaz();

        uiJwt.TextChanged += (_, _) =>
        {
            uiJwtIndicador.Text =
                string.IsNullOrWhiteSpace(uiJwt.Text)
                    ? "Sin token"
                    : "Token preparado";
        };

        ResumeLayout(true);
    }

    // ====================================================
    // DISEÑO PRINCIPAL
    // ====================================================

    private void ConstruirInterfaz()
    {
        var principal = new TableLayoutPanel
        {
            Dock = DockStyle.Fill,
            ColumnCount = 1,
            RowCount = 4,
            BackColor = Fondo,
            Padding = new Padding(14)
        };

        principal.RowStyles.Add(
            new RowStyle(SizeType.Absolute, 112));

        principal.RowStyles.Add(
            new RowStyle(SizeType.Absolute, 106));

        principal.RowStyles.Add(
            new RowStyle(SizeType.Percent, 100));

        principal.RowStyles.Add(
            new RowStyle(SizeType.Absolute, 42));

        principal.Controls.Add(CrearCabecera(), 0, 0);
        principal.Controls.Add(CrearPanelJwt(), 0, 1);
        principal.Controls.Add(CrearPestanas(), 0, 2);
        principal.Controls.Add(CrearPie(), 0, 3);

        Controls.Add(principal);
    }

    private Control CrearCabecera()
    {
        cabecera = new Panel
        {
            Dock = DockStyle.Fill,
            Margin = new Padding(0, 0, 0, 10)
        };

        cabecera.Paint += (_, e) => DibujarCabecera(e.Graphics);

        return cabecera;
    }

    private void DibujarCabecera(Graphics g)
    {
        if (cabecera is null)
            return;

        g.SmoothingMode = SmoothingMode.AntiAlias;

        Rectangle area = cabecera.ClientRectangle;

        using (var degradado = new LinearGradientBrush(
            area,
            Azul,
            Color.FromArgb(36, 102, 184),
            LinearGradientMode.Horizontal))
        {
            g.FillRectangle(degradado, area);
        }

        // Logotipo de vehículo dibujado en GDI+.
        using (var fondoLogo = new SolidBrush(
            Color.FromArgb(48, 255, 255, 255)))
        {
            g.FillRoundedRectangleCompat(
                fondoLogo,
                new Rectangle(18, 18, 68, 66),
                15);
        }

        using (var lapiz = new Pen(Color.White, 3))
        {
            g.DrawLine(lapiz, 31, 60, 38, 44);
            g.DrawLine(lapiz, 38, 44, 68, 44);
            g.DrawLine(lapiz, 68, 44, 76, 60);
            g.DrawLine(lapiz, 29, 60, 78, 60);
            g.DrawLine(lapiz, 29, 60, 29, 69);
            g.DrawLine(lapiz, 78, 60, 78, 69);
            g.DrawLine(lapiz, 29, 69, 78, 69);

            g.DrawEllipse(lapiz, 35, 65, 9, 9);
            g.DrawEllipse(lapiz, 64, 65, 9, 9);
        }

        using var titulo = new Font(
            "Segoe UI", 18, FontStyle.Bold);

        using var subtitulo = new Font(
            "Segoe UI", 10, FontStyle.Regular);

        g.DrawString(
            "ADMINISTRACIÓN DE VEHÍCULOS",
            titulo,
            Brushes.White,
            105,
            24);

        using var grisClaro = new SolidBrush(
            Color.FromArgb(220, 235, 255));

        g.DrawString(
            "Vehículos  •  Compradores  •  Ventas",
            subtitulo,
            grisClaro,
            108,
            62);

        // Indicadores reales, actualizados al consultar las API.
        if (area.Width >= 1050)
        {
            int x = area.Width - 366;

            DibujarIndicador(
                g, x, 20, "Vehículos", cantidadVehiculos);

            DibujarIndicador(
                g, x + 118, 20, "Compradores", cantidadCompradores);

            DibujarIndicador(
                g, x + 236, 20, "Ventas", cantidadVentas);
        }
    }

    private static void DibujarIndicador(
        Graphics g,
        int x,
        int y,
        string nombre,
        string cantidad)
    {
        Rectangle rect = new(x, y, 106, 64);

        using var fondo = new SolidBrush(
            Color.FromArgb(48, 255, 255, 255));

        g.FillRoundedRectangleCompat(fondo, rect, 10);

        using var f1 = new Font("Segoe UI", 8);
        using var f2 = new Font(
            "Segoe UI", 17, FontStyle.Bold);

        using var textoClaro = new SolidBrush(
            Color.FromArgb(225, 239, 255));

        g.DrawString(nombre, f1, textoClaro, x + 10, y + 7);
        g.DrawString(cantidad, f2, Brushes.White, x + 9, y + 25);
    }

    // ====================================================
    // JWT
    // ====================================================

    private Control CrearPanelJwt()
    {
        var panel = new Panel
        {
            Dock = DockStyle.Fill,
            BackColor = Color.White,
            Margin = new Padding(0, 0, 0, 10),
            Padding = new Padding(14, 9, 14, 9)
        };

        var contenido = new TableLayoutPanel
        {
            Dock = DockStyle.Fill,
            ColumnCount = 5,
            RowCount = 2
        };

        contenido.ColumnStyles.Add(
            new ColumnStyle(SizeType.Percent, 100));

        contenido.ColumnStyles.Add(
            new ColumnStyle(SizeType.Absolute, 104));

        contenido.ColumnStyles.Add(
            new ColumnStyle(SizeType.Absolute, 132));

        contenido.ColumnStyles.Add(
            new ColumnStyle(SizeType.Absolute, 90));

        contenido.ColumnStyles.Add(
            new ColumnStyle(SizeType.Absolute, 90));

        contenido.RowStyles.Add(
            new RowStyle(SizeType.Absolute, 27));

        contenido.RowStyles.Add(
            new RowStyle(SizeType.Percent, 100));

        var encabezado = new FlowLayoutPanel
        {
            Dock = DockStyle.Fill,
            WrapContents = false
        };

        encabezado.Controls.Add(new Label
        {
            Text = "Acceso JWT",
            Font = new Font("Segoe UI", 10, FontStyle.Bold),
            AutoSize = true,
            ForeColor = Azul,
            Margin = new Padding(2, 3, 14, 0)
        });

        uiJwtIndicador.Margin = new Padding(0, 5, 0, 0);
        encabezado.Controls.Add(uiJwtIndicador);

        var mostrar = NuevoBoton("Mostrar", false);
        var ver = NuevoBoton("Ver completo", false);
        var pegar = NuevoBoton("Pegar", false);
        var limpiar = NuevoBoton("Limpiar", false);

        mostrar.Click += (_, _) =>
        {
            bool visible = uiJwt.UseSystemPasswordChar;

            uiJwt.UseSystemPasswordChar = !visible;
            mostrar.Text = visible ? "Ocultar" : "Mostrar";
        };

        ver.Click += (_, _) => VerTokenCompleto();

        pegar.Click += (_, _) =>
        {
            try
            {
                if (Clipboard.ContainsText())
                {
                    uiJwt.Text = Clipboard.GetText().Trim();
                    Estado("Token pegado correctamente.");
                }
                else
                {
                    Estado("El portapapeles está vacío.", true);
                }
            }
            catch
            {
                Estado("No se pudo acceder al portapapeles.", true);
            }
        };

        limpiar.Click += (_, _) =>
        {
            uiJwt.Clear();
            uiJwt.Focus();
            Estado("Token limpiado.");
        };

        contenido.Controls.Add(encabezado, 0, 0);
        contenido.SetColumnSpan(encabezado, 5);

        contenido.Controls.Add(uiJwt, 0, 1);
        contenido.Controls.Add(mostrar, 1, 1);
        contenido.Controls.Add(ver, 2, 1);
        contenido.Controls.Add(pegar, 3, 1);
        contenido.Controls.Add(limpiar, 4, 1);

        panel.Controls.Add(contenido);

        return panel;
    }

    private void VerTokenCompleto()
    {
        if (string.IsNullOrWhiteSpace(uiJwt.Text))
        {
            Estado("Primero ingrese el token JWT.", true);
            return;
        }

        using var ventana = new Form
        {
            Text = "Token JWT",
            Size = new Size(760, 320),
            MinimumSize = new Size(500, 250),
            StartPosition = FormStartPosition.CenterParent,
            BackColor = Fondo
        };

        var layout = new TableLayoutPanel
        {
            Dock = DockStyle.Fill,
            RowCount = 2,
            Padding = new Padding(16)
        };

        layout.RowStyles.Add(
            new RowStyle(SizeType.Percent, 100));

        layout.RowStyles.Add(
            new RowStyle(SizeType.Absolute, 48));

        var texto = new TextBox
        {
            Dock = DockStyle.Fill,
            Multiline = true,
            WordWrap = true,
            ReadOnly = true,
            ScrollBars = ScrollBars.Vertical,
            Text = uiJwt.Text,
            Font = new Font("Consolas", 10)
        };

        var cerrar = NuevoBoton("Cerrar");
        cerrar.Width = 120;
        cerrar.Dock = DockStyle.Right;
        cerrar.Click += (_, _) => ventana.Close();

        layout.Controls.Add(texto, 0, 0);
        layout.Controls.Add(cerrar, 0, 1);

        ventana.Controls.Add(layout);
        ventana.ShowDialog(this);
    }

    // ====================================================
    // PESTAÑAS
    // ====================================================

    private Control CrearPestanas()
    {
        var tabs = new TabControl
        {
            Dock = DockStyle.Fill,
            DrawMode = TabDrawMode.OwnerDrawFixed,
            SizeMode = TabSizeMode.Fixed,
            ItemSize = new Size(165, 39),
            Margin = new Padding(0, 0, 0, 10)
        };

        tabs.DrawItem += (_, e) =>
        {
            bool activo = e.Index == tabs.SelectedIndex;

            using var fondo = new SolidBrush(
                activo ? Azul : Color.FromArgb(225, 233, 244));

            e.Graphics.FillRectangle(fondo, e.Bounds);

            TextRenderer.DrawText(
                e.Graphics,
                tabs.TabPages[e.Index].Text,
                new Font("Segoe UI", 10, FontStyle.Bold),
                e.Bounds,
                activo ? Color.White : Azul,
                TextFormatFlags.HorizontalCenter |
                TextFormatFlags.VerticalCenter);
        };

        tabs.TabPages.Add(CrearPaginaVehiculos());
        tabs.TabPages.Add(CrearPaginaCompradores());
        tabs.TabPages.Add(CrearPaginaVentas());

        return tabs;
    }

    private TabPage CrearPaginaVehiculos()
    {
        var formulario = CrearFormulario(
            "DATOS DEL VEHÍCULO",
            camposVehiculo,
            4,
            ("marca", "Marca", ""),
            ("modelo", "Modelo", ""),
            ("placa", "Placa", ""),
            ("chasis", "Chasis", ""),
            ("anio", "Año", ""),
            ("color", "Color", ""),
            ("precio", "Precio USD", ""),
            ("estado", "Estado", "DISPONIBLE")
        );

        var registrar = NuevoBoton("Registrar vehículo");
        var actualizar = NuevoBoton("Actualizar listado", false);

        registrar.Click += async (_, _) =>
            await Ejecutar(registrar, RegistrarVehiculoAsync);

        actualizar.Click += async (_, _) =>
            await Ejecutar(actualizar, ConsultarVehiculosAsync);

        return CrearPagina(
            "Vehículos",
            formulario,
            204,
            vistaVehiculos,
            registrar,
            actualizar);
    }

    private TabPage CrearPaginaCompradores()
    {
        var formulario = CrearFormulario(
            "DATOS DEL COMPRADOR",
            camposComprador,
            3,
            ("documento", "Documento", ""),
            ("nombre", "Nombre completo", ""),
            ("correo", "Correo electrónico", "")
        );

        var registrar = NuevoBoton("Registrar comprador");
        var actualizar = NuevoBoton("Actualizar listado", false);

        registrar.Click += async (_, _) =>
            await Ejecutar(registrar, RegistrarCompradorAsync);

        actualizar.Click += async (_, _) =>
            await Ejecutar(actualizar, ConsultarCompradoresAsync);

        return CrearPagina(
            "Compradores",
            formulario,
            123,
            vistaCompradores,
            registrar,
            actualizar);
    }

    private TabPage CrearPaginaVentas()
    {
        var actualizar = NuevoBoton("Actualizar ventas");

        actualizar.Click += async (_, _) =>
            await Ejecutar(actualizar, ConsultarVentasAsync);

        return CrearPagina(
            "Ventas",
            graficoVentas,
            95,
            vistaVentas,
            actualizar);
    }

    private TabPage CrearPagina(
        string nombre,
        Control? formulario,
        int altoFormulario,
        VistaListado vista,
        params Button[] botones)
    {
        var pagina = new TabPage(nombre)
        {
            BackColor = Fondo,
            Padding = new Padding(10)
        };

        var layout = new TableLayoutPanel
        {
            Dock = DockStyle.Fill,
            RowCount = 3,
            ColumnCount = 1,
            BackColor = Fondo
        };

        layout.RowStyles.Add(
            new RowStyle(SizeType.Absolute, altoFormulario));

        layout.RowStyles.Add(
            new RowStyle(SizeType.Absolute, 56));

        layout.RowStyles.Add(
            new RowStyle(SizeType.Percent, 100));

        if (formulario != null)
        {
            layout.Controls.Add(formulario, 0, 0);
        }

        
var acciones = new TableLayoutPanel
{
    Dock = DockStyle.Fill,
    ColumnCount = botones.Length + 1,
    RowCount = 1,
    BackColor = Fondo,
    Padding = new Padding(0, 6, 0, 6),
    Margin = new Padding(0)
};

acciones.RowStyles.Add(
    new RowStyle(SizeType.Percent, 100));

for (int i = 0; i < botones.Length; i++)
{
    acciones.ColumnStyles.Add(
        new ColumnStyle(SizeType.Absolute, 215));

    Button boton = botones[i];

    boton.Dock = DockStyle.Fill;
    boton.AutoSize = false;
    boton.Height = 40;
    boton.Margin = new Padding(0, 2, 12, 2);

    acciones.Controls.Add(boton, i, 0);
}

acciones.ColumnStyles.Add(
    new ColumnStyle(SizeType.Percent, 100));


        layout.Controls.Add(acciones, 0, 1);
        layout.Controls.Add(CrearAreaListado(vista), 0, 2);

        pagina.Controls.Add(layout);
        return pagina;
    }

    // ====================================================
    // CAMPOS
    // ====================================================

    private Control CrearFormulario(
        string titulo,
        Dictionary<string, TextBox> destino,
        int columnas,
        params (string Clave, string Etiqueta, string Valor)[] campos)
    {
        var grupo = new GroupBox
        {
            Text = titulo,
            Dock = DockStyle.Fill,
            BackColor = Color.White,
            ForeColor = Azul,
            Font = new Font("Segoe UI", 9.5f, FontStyle.Bold),
            Padding = new Padding(12, 10, 12, 10)
        };

        int filas = (int)Math.Ceiling(
            (double)campos.Length / columnas);

        var tabla = new TableLayoutPanel
        {
            Dock = DockStyle.Fill,
            ColumnCount = columnas,
            RowCount = filas
        };

        for (int i = 0; i < columnas; i++)
        {
            tabla.ColumnStyles.Add(
                new ColumnStyle(
                    SizeType.Percent,
                    100f / columnas));
        }

        for (int i = 0; i < filas; i++)
        {
            tabla.RowStyles.Add(
                new RowStyle(
                    SizeType.Percent,
                    100f / filas));
        }

        for (int i = 0; i < campos.Length; i++)
        {
            var campo = campos[i];

            var contenedor = new TableLayoutPanel
            {
                Dock = DockStyle.Fill,
                RowCount = 2,
                ColumnCount = 1,
                Margin = new Padding(8, 5, 8, 5)
            };

            contenedor.RowStyles.Add(
                new RowStyle(SizeType.Absolute, 24));

            contenedor.RowStyles.Add(
                new RowStyle(SizeType.Percent, 100));

            var etiqueta = new Label
            {
                Text = campo.Etiqueta,
                Dock = DockStyle.Fill,
                ForeColor = Texto,
                Font = new Font("Segoe UI", 9)
            };

            var entrada = new TextBox
            {
                Text = campo.Valor,
                Dock = DockStyle.Top,
                Font = new Font("Segoe UI", 10),
                BorderStyle = BorderStyle.FixedSingle
            };

            contenedor.Controls.Add(etiqueta, 0, 0);
            contenedor.Controls.Add(entrada, 0, 1);

            destino[campo.Clave] = entrada;

            tabla.Controls.Add(
                contenedor,
                i % columnas,
                i / columnas);
        }

        grupo.Controls.Add(tabla);
        return grupo;
    }

    // ====================================================
    // LISTADOS, BÚSQUEDA Y SCROLL
    // ====================================================

    private Control CrearAreaListado(VistaListado vista)
    {
        var panel = new TableLayoutPanel
        {
            Dock = DockStyle.Fill,
            RowCount = 2,
            ColumnCount = 1,
            Padding = new Padding(12),
            BackColor = Color.White
        };

        panel.RowStyles.Add(
            new RowStyle(SizeType.Absolute, 45));

        panel.RowStyles.Add(
            new RowStyle(SizeType.Percent, 100));

        var superior = new TableLayoutPanel
        {
            Dock = DockStyle.Fill,
            ColumnCount = 2
        };

        superior.ColumnStyles.Add(
            new ColumnStyle(SizeType.Percent, 100));

        superior.ColumnStyles.Add(
            new ColumnStyle(SizeType.Absolute, 265));

        vista.Contador.Dock = DockStyle.Fill;
        vista.Contador.TextAlign = ContentAlignment.MiddleLeft;
        vista.Contador.ForeColor = Azul;
        vista.Contador.Font = new Font(
            "Segoe UI", 10, FontStyle.Bold);

        vista.Buscar.Dock = DockStyle.Fill;
        vista.Buscar.PlaceholderText = "Buscar en los registros...";
        vista.Buscar.Font = new Font("Segoe UI", 10);
        vista.Buscar.Margin = new Padding(5, 6, 5, 6);

        vista.Buscar.TextChanged += (_, _) =>
            Filtrar(vista);

        superior.Controls.Add(vista.Contador, 0, 0);
        superior.Controls.Add(vista.Buscar, 1, 0);

        panel.Controls.Add(superior, 0, 0);
        panel.Controls.Add(vista.Contenedor, 0, 1);

        return panel;
    }

    private static DataGridView NuevaTabla()
    {
        var tabla = new DataGridView
        {
            Dock = DockStyle.Fill,
            ReadOnly = true,
            AllowUserToAddRows = false,
            AllowUserToDeleteRows = false,
            AllowUserToOrderColumns = true,
            AllowUserToResizeColumns = true,
            AllowUserToResizeRows = false,
            AutoGenerateColumns = true,
            AutoSizeColumnsMode = DataGridViewAutoSizeColumnsMode.None,
            ScrollBars = ScrollBars.Both,
            RowHeadersVisible = false,
            MultiSelect = false,
            SelectionMode = DataGridViewSelectionMode.FullRowSelect,
            BackgroundColor = Color.White,
            BorderStyle = BorderStyle.None,
            GridColor = Color.FromArgb(225, 232, 242),
            EnableHeadersVisualStyles = false,
            ColumnHeadersHeight = 38,
            ColumnHeadersHeightSizeMode =
                DataGridViewColumnHeadersHeightSizeMode.DisableResizing,
            ShowCellToolTips = true
        };

        tabla.RowTemplate.Height = 31;

        tabla.ColumnHeadersDefaultCellStyle.BackColor = Azul;
        tabla.ColumnHeadersDefaultCellStyle.ForeColor = Color.White;
        tabla.ColumnHeadersDefaultCellStyle.Font =
            new Font("Segoe UI", 9, FontStyle.Bold);

        tabla.DefaultCellStyle.Font =
            new Font("Segoe UI", 9);

        tabla.DefaultCellStyle.SelectionBackColor =
            Color.FromArgb(212, 230, 250);

        tabla.DefaultCellStyle.SelectionForeColor = Texto;

        tabla.AlternatingRowsDefaultCellStyle.BackColor =
            Color.FromArgb(248, 250, 254);

        tabla.DataBindingComplete += (_, _) =>
        {
            foreach (DataGridViewColumn columna in tabla.Columns)
            {
                columna.MinimumWidth = 105;
                columna.Width = 165;

                if (columna.Name.Equals(
                    "nombre",
                    StringComparison.OrdinalIgnoreCase))
                {
                    columna.Width = 230;
                }
                else if (columna.Name.Equals(
                    "operacionId",
                    StringComparison.OrdinalIgnoreCase))
                {
                    columna.Width = 280;
                }
                else if (columna.Name.Equals(
                    "fechaUTC",
                    StringComparison.OrdinalIgnoreCase))
                {
                    columna.Width = 210;
                }
            }
        };

        return tabla;
    }

    private static void Filtrar(VistaListado vista)
    {
        if (vista.Datos == null)
        {
            vista.Contador.Text = $"{vista.Nombre}: sin consultar";
            return;
        }

        string busqueda = vista.Buscar.Text.Trim();
        DataTable resultado = vista.Datos.Clone();

        foreach (DataRow fila in vista.Datos.Rows)
        {
            bool coincide = busqueda.Length == 0;

            if (!coincide)
            {
                foreach (object valor in fila.ItemArray)
                {
                    if ((valor?.ToString() ?? "").Contains(
                        busqueda,
                        StringComparison.OrdinalIgnoreCase))
                    {
                        coincide = true;
                        break;
                    }
                }
            }

            if (coincide)
                resultado.ImportRow(fila);
        }

        vista.Tabla.DataSource = resultado;
        vista.Contador.Text =
            $"{resultado.Rows.Count} de " +
            $"{vista.Datos.Rows.Count} {vista.Nombre}";

        vista.Vacio.Visible = resultado.Rows.Count == 0;
        vista.Vacio.Text = vista.Datos.Rows.Count == 0
            ? "No existen registros para mostrar."
            : "No se encontraron coincidencias.";

        if (vista.Vacio.Visible)
            vista.Vacio.BringToFront();
    }

    private static DataTable ConvertirJson(string json)
    {
        using JsonDocument documento = JsonDocument.Parse(json);

        if (documento.RootElement.ValueKind != JsonValueKind.Array)
            throw new JsonException("Se esperaba una lista JSON.");

        DataTable tabla = new();

        foreach (JsonElement elemento in documento.RootElement.EnumerateArray())
        {
            if (elemento.ValueKind != JsonValueKind.Object)
                throw new JsonException("Registro inválido.");

            foreach (JsonProperty propiedad in elemento.EnumerateObject())
            {
                if (!tabla.Columns.Contains(propiedad.Name))
                    tabla.Columns.Add(propiedad.Name, typeof(string));
            }
        }

        foreach (JsonElement elemento in documento.RootElement.EnumerateArray())
        {
            DataRow fila = tabla.NewRow();

            foreach (JsonProperty propiedad in elemento.EnumerateObject())
            {
                fila[propiedad.Name] = propiedad.Value.ValueKind switch
                {
                    JsonValueKind.Null => "",
                    JsonValueKind.String =>
                        propiedad.Value.GetString() ?? "",
                    _ => propiedad.Value.ToString()
                };
            }

            tabla.Rows.Add(fila);
        }

        return tabla;
    }

    // ====================================================
    // VEHÍCULOS
    // ====================================================

    private async Task RegistrarVehiculoAsync()
    {
        string marca = Campo(camposVehiculo, "marca");
        string modelo = Campo(camposVehiculo, "modelo");
        string placa = Campo(camposVehiculo, "placa");
        string chasis = Campo(camposVehiculo, "chasis");
        string color = Campo(camposVehiculo, "color");
        string estado = Campo(camposVehiculo, "estado");

        if (string.IsNullOrWhiteSpace(marca) ||
            string.IsNullOrWhiteSpace(modelo) ||
            string.IsNullOrWhiteSpace(placa) ||
            string.IsNullOrWhiteSpace(chasis))
        {
            Estado("Complete los campos obligatorios del vehículo.", true);
            return;
        }

        if (!int.TryParse(
            Campo(camposVehiculo, "anio"),
            out int anio))
        {
            Estado("Ingrese un año válido.", true);
            return;
        }

        if (!decimal.TryParse(
            Campo(camposVehiculo, "precio"),
            NumberStyles.Number,
            CultureInfo.InvariantCulture,
            out decimal precio))
        {
            Estado("Precio inválido. Ejemplo: 19000.00", true);
            return;
        }

        var datos = new
        {
            marca,
            modelo,
            placa,
            chasis,
            anio,
            color,
            precio,
            estado
        };

        RespuestaApi? r = await Solicitar(
            HttpMethod.Post, "api/vehiculos", datos);

        if (r == null)
            return;

        bool actualizado = await ConsultarListado(
            "api/vehiculos", vistaVehiculos);

        Estado(
            $"HTTP {r.Codigo}: vehículo registrado." +
            (actualizado ? " Listado actualizado." : ""),
            !actualizado);
    }

    private async Task ConsultarVehiculosAsync()
    {
        await ConsultarListado("api/vehiculos", vistaVehiculos);
    }

    // ====================================================
    // COMPRADORES
    // ====================================================

    private async Task RegistrarCompradorAsync()
    {
        string documento = Campo(camposComprador, "documento");
        string nombre = Campo(camposComprador, "nombre");
        string correo = Campo(camposComprador, "correo");

        if (documento.Length < 3 ||
            nombre.Length < 2 ||
            !correo.Contains('@') ||
            !correo.Contains('.'))
        {
            Estado("Revise los datos del comprador.", true);
            return;
        }

        var datos = new
        {
            documento,
            nombre,
            correo
        };

        RespuestaApi? r = await Solicitar(
            HttpMethod.Post, "api/compradores", datos);

        if (r == null)
            return;

        bool actualizado = await ConsultarListado(
            "api/compradores", vistaCompradores);

        Estado(
            $"HTTP {r.Codigo}: comprador registrado." +
            (actualizado ? " Listado actualizado." : ""),
            !actualizado);
    }

    private async Task ConsultarCompradoresAsync()
    {
        await ConsultarListado("api/compradores", vistaCompradores);
    }

    // ====================================================
    // VENTAS
    // ====================================================

    private async Task ConsultarVentasAsync()
    {
        await ConsultarListado("api/ventas", vistaVentas);
    }

    // ====================================================
    // COMUNICACIÓN HTTP
    // ====================================================

    private async Task<bool> ConsultarListado(
        string ruta,
        VistaListado vista)
    {
        RespuestaApi? respuesta = await Solicitar(
            HttpMethod.Get, ruta);

        if (respuesta == null)
        {
            vista.Datos = null;
            vista.Tabla.DataSource = null;
            vista.Vacio.Text = "No se pudo cargar la información.";
            vista.Vacio.Visible = true;
            vista.Vacio.BringToFront();
            return false;
        }

        try
        {
            DataTable datos = ConvertirJson(respuesta.Cuerpo);

            vista.Datos = datos;
            Filtrar(vista);

            if (vista == vistaVehiculos)
            {
                cantidadVehiculos = datos.Rows.Count.ToString();
            }
            else if (vista == vistaCompradores)
            {
                cantidadCompradores = datos.Rows.Count.ToString();
            }
            else if (vista == vistaVentas)
            {
                cantidadVentas = datos.Rows.Count.ToString();
                graficoVentas.Actualizar(datos);
            }

            cabecera?.Invalidate();

            Estado(
                $"HTTP {respuesta.Codigo}: " +
                $"{datos.Rows.Count} {vista.Nombre} consultados.");

            return true;
        }
        catch (JsonException)
        {
            Estado("La API devolvió un JSON inesperado.", true);
            return false;
        }
    }

    private async Task<RespuestaApi?> Solicitar(
        HttpMethod metodo,
        string ruta,
        object? datos = null)
    {
        string? jwt = ObtenerJwt();

        if (jwt == null)
            return null;

        Estado($"Consultando {metodo} /{ruta}...");

        try
        {
            RespuestaApi respuesta = await ClienteApi.Enviar(
                metodo, ruta, jwt, datos);

            if (!respuesta.Exitoso)
            {
                string mensaje = respuesta.Codigo switch
                {
                    400 => "Solicitud incorrecta.",
                    401 => "JWT inválido o vencido.",
                    403 => "Acceso denegado.",
                    404 => "Recurso no encontrado.",
                    409 => "Conflicto de datos.",
                    422 => "Datos inválidos.",
                    500 => "Error interno del servicio.",
                    502 => "NGINX no pudo conectarse.",
                    503 => "Servicio no disponible.",
                    _ => "Operación no completada."
                };

                string detalle = respuesta.Cuerpo;

                if (detalle.Length > 160)
                    detalle = detalle[..160];

                Estado(
                    $"HTTP {respuesta.Codigo}: {mensaje} {detalle}",
                    true);

                return null;
            }

            return respuesta;
        }
        catch (HttpRequestException)
        {
            Estado("No se pudo conectar con NGINX (8090).", true);
        }
        catch (TaskCanceledException)
        {
            Estado("Tiempo de espera agotado.", true);
        }

        return null;
    }

    private string? ObtenerJwt()
    {
        string token = uiJwt.Text.Trim();

        if (token.StartsWith(
            "Bearer ",
            StringComparison.OrdinalIgnoreCase))
        {
            token = token[7..].Trim();
        }

        if (string.IsNullOrWhiteSpace(token))
        {
            Estado("Primero ingrese un token JWT.", true);
            uiJwt.Focus();
            return null;
        }

        return token;
    }

    private static string Campo(
        Dictionary<string, TextBox> campos,
        string nombre)
    {
        return campos[nombre].Text.Trim();
    }

    // ====================================================
    // BOTONES Y ESTADO
    // ====================================================

    private static Button NuevoBoton(
        string texto,
        bool principal = true)
    {
        var b = new Button
        {
            Text = texto,
            Dock = DockStyle.Fill,
            Width = principal ? 185 : 125,
            Height = 37,
            Margin = new Padding(5, 3, 5, 3),
            FlatStyle = FlatStyle.Flat,
            BackColor = principal
                ? Azul
                : Color.FromArgb(226, 236, 250),
            ForeColor = principal ? Color.White : Azul,
            Font = new Font("Segoe UI", 9, FontStyle.Bold),
            Cursor = Cursors.Hand
        };

        b.FlatAppearance.BorderSize = 0;
        b.FlatAppearance.MouseOverBackColor = principal
            ? AzulClaro
            : Color.FromArgb(210, 226, 246);

        return b;
    }

    private Control CrearPie()
    {
        var panel = new TableLayoutPanel
        {
            Dock = DockStyle.Fill,
            ColumnCount = 2,
            Padding = new Padding(12, 4, 12, 4),
            BackColor = Color.White
        };

        panel.ColumnStyles.Add(
            new ColumnStyle(SizeType.Percent, 100));

        panel.ColumnStyles.Add(
            new ColumnStyle(SizeType.Absolute, 120));

        panel.Controls.Add(uiEstado, 0, 0);
        panel.Controls.Add(uiProgreso, 1, 0);

        return panel;
    }

    private void Estado(string mensaje, bool error = false)
    {
        uiEstado.ForeColor = error ? Rojo : Verde;
        uiEstado.Text = mensaje;
    }

    private async Task Ejecutar(
        Button boton,
        Func<Task> accion)
    {
        boton.Enabled = false;
        uiProgreso.Visible = true;

        try
        {
            await accion();
        }
        catch (Exception ex)
        {
            Estado($"Error inesperado: {ex.Message}", true);
        }
        finally
        {
            uiProgreso.Visible = false;
            boton.Enabled = true;
        }
    }

    // Manejadores del diseñador anterior.
    private async void btnConsultar_Click(
        object? sender,
        EventArgs e)
    {
        await ConsultarVehiculosAsync();
    }

    private void lblTitulo_Click(
        object sender,
        EventArgs e)
    {
    }

    private sealed class VistaListado
    {
        public string Nombre { get; }
        public DataGridView Tabla { get; } = NuevaTabla();
        public TextBox Buscar { get; } = new();
        public Label Contador { get; } = new();
        public DataTable? Datos { get; set; }

        public Panel Contenedor { get; } = new()
        {
            Dock = DockStyle.Fill,
            BackColor = Color.White
        };

        public Label Vacio { get; } = new()
        {
            Dock = DockStyle.Fill,
            Text = "Pulse Actualizar listado para cargar los registros.",
            TextAlign = ContentAlignment.MiddleCenter,
            ForeColor = Gris,
            Font = new Font("Segoe UI", 11)
        };

        public VistaListado(string nombre)
        {
            Nombre = nombre;
            Contador.Text = $"{nombre}: sin consultar";

            Contenedor.Controls.Add(Tabla);
            Contenedor.Controls.Add(Vacio);
            Vacio.BringToFront();
        }
    }

    // ====================================================
    // GRÁFICO REAL DE ESTADOS DE VENTAS
    // ====================================================

    private sealed class GraficoVentas : Panel
    {
        private bool consultado;
        private int completadas;
        private int revision;
        private int otros;

        public GraficoVentas()
        {
            Dock = DockStyle.Fill;
            BackColor = Color.White;
            Margin = new Padding(0, 0, 0, 5);
            DoubleBuffered = true;
        }

        public void Actualizar(DataTable datos)
        {
            consultado = true;
            completadas = 0;
            revision = 0;
            otros = 0;

            foreach (DataRow fila in datos.Rows)
            {
                string estado = datos.Columns.Contains("estado")
                    ? Convert.ToString(fila["estado"]) ?? ""
                    : "";

                if (estado.Equals(
                    "COMPLETADA",
                    StringComparison.OrdinalIgnoreCase))
                {
                    completadas++;
                }
                else if (estado.Equals(
                    "EN_REVISION",
                    StringComparison.OrdinalIgnoreCase))
                {
                    revision++;
                }
                else
                {
                    otros++;
                }
            }

            Invalidate();
        }

        protected override void OnPaint(PaintEventArgs e)
        {
            base.OnPaint(e);

            Graphics g = e.Graphics;
            g.SmoothingMode = SmoothingMode.AntiAlias;

            using var fuenteTitulo = new Font(
                "Segoe UI", 10, FontStyle.Bold);

            using var fuenteDatos = new Font(
                "Segoe UI", 9);

            g.DrawString(
                "ESTADO DE LAS VENTAS",
                fuenteTitulo,
                new SolidBrush(Azul),
                15,
                9);

            if (!consultado)
            {
                g.DrawString(
                    "Actualice las ventas para visualizar sus estados.",
                    fuenteDatos,
                    new SolidBrush(Gris),
                    16,
                    39);
                return;
            }

            int total = completadas + revision + otros;

            string resumen =
                $"Completadas: {completadas}    " +
                $"En revisión: {revision}    " +
                $"Otros estados: {otros}";

            g.DrawString(
                resumen,
                fuenteDatos,
                new SolidBrush(Texto),
                17,
                34);

            Rectangle barra = new(
                16, 64, Math.Max(1, Width - 33), 12);

            using var baseBarra = new SolidBrush(
                Color.FromArgb(226, 233, 241));

            g.FillRectangle(baseBarra, barra);

            if (total == 0)
                return;

            int anchoCompletadas =
                (int)(barra.Width * completadas / (double)total);

            int anchoRevision =
                (int)(barra.Width * revision / (double)total);

            using var brochaVerde = new SolidBrush(Verde);
            using var brochaAmarilla = new SolidBrush(
                Color.FromArgb(220, 162, 50));
            using var brochaAzul = new SolidBrush(AzulClaro);

            g.FillRectangle(
                brochaVerde,
                barra.X,
                barra.Y,
                anchoCompletadas,
                barra.Height);

            g.FillRectangle(
                brochaAmarilla,
                barra.X + anchoCompletadas,
                barra.Y,
                anchoRevision,
                barra.Height);

            int resto = barra.Width - anchoCompletadas - anchoRevision;

            if (resto > 0)
            {
                g.FillRectangle(
                    brochaAzul,
                    barra.X + anchoCompletadas + anchoRevision,
                    barra.Y,
                    resto,
                    barra.Height);
            }
        }
    }
}

// ========================================================
// CLIENTE HTTP
// ========================================================

internal static class ClienteApi
{
    private static readonly HttpClient Http = new()
    {
        BaseAddress = new Uri("http://127.0.0.1:8090/"),
        Timeout = TimeSpan.FromSeconds(20)
    };

    public static async Task<RespuestaApi> Enviar(
        HttpMethod metodo,
        string ruta,
        string token,
        object? datos = null)
    {
        using var solicitud =
            new HttpRequestMessage(metodo, ruta);

        solicitud.Headers.Authorization =
            new AuthenticationHeaderValue("Bearer", token);

        if (datos != null)
        {
            string json = JsonSerializer.Serialize(datos);

            solicitud.Content = new StringContent(
                json,
                Encoding.UTF8,
                "application/json");
        }

        using HttpResponseMessage respuesta =
            await Http.SendAsync(solicitud);

        string contenido =
            await respuesta.Content.ReadAsStringAsync();

        return new RespuestaApi(
            (int)respuesta.StatusCode,
            contenido,
            respuesta.IsSuccessStatusCode);
    }
}

internal sealed record RespuestaApi(
    int Codigo,
    string Cuerpo,
    bool Exitoso);

// ========================================================
// DIBUJO DE RECTÁNGULOS REDONDEADOS SIN LIBRERÍAS EXTERNAS
// ========================================================

internal static class DibujosUI
{
    public static void FillRoundedRectangleCompat(
        this Graphics g,
        Brush brush,
        Rectangle rect,
        int radio)
    {
        using var path = new GraphicsPath();

        int diametro = radio * 2;

        path.AddArc(rect.Left, rect.Top,
            diametro, diametro, 180, 90);

        path.AddArc(rect.Right - diametro, rect.Top,
            diametro, diametro, 270, 90);

        path.AddArc(rect.Right - diametro,
            rect.Bottom - diametro,
            diametro, diametro, 0, 90);

        path.AddArc(rect.Left,
            rect.Bottom - diametro,
            diametro, diametro, 90, 90);

        path.CloseFigure();
        g.FillPath(brush, path);
    }
}
